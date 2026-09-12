import path from "node:path";

import type { GitHubTreeItem } from "@/lib/github/github-client";
import type {
  DependencyEdge,
  RepositoryAnalysis,
  RepositoryFile,
  RepositoryMetadata,
} from "@/types/repository";

const MAX_VISIBLE_FILES = 120;
const MAX_ANALYZED_SOURCE_FILES = 48;
const MAX_DISTRICTS = 9;

const EXCLUDED_SEGMENTS = new Set([
  ".git",
  ".next",
  ".nuxt",
  ".output",
  ".turbo",
  ".vercel",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "target",
  "vendor",
]);

const SKIPPED_FILES = /(?:\.min\.(?:js|css)$|\.map$|\.snap$|lock$|package-lock\.json$|pnpm-lock\.yaml$|yarn\.lock$)/i;
const WRAPPER_DIRECTORIES = new Set(["src", "app", "apps", "lib", "packages"]);

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ts: "TypeScript",
  tsx: "TypeScript",
  js: "JavaScript",
  jsx: "JavaScript",
  mjs: "JavaScript",
  cjs: "JavaScript",
  py: "Python",
  rs: "Rust",
  go: "Go",
  java: "Java",
  kt: "Kotlin",
  kts: "Kotlin",
  cs: "C#",
  cpp: "C++",
  cc: "C++",
  c: "C",
  h: "C/C++ Header",
  rb: "Ruby",
  php: "PHP",
  swift: "Swift",
  scala: "Scala",
  vue: "Vue",
  svelte: "Svelte",
  css: "CSS",
  scss: "SCSS",
  html: "HTML",
  sql: "SQL",
  json: "JSON",
  md: "Markdown",
  mdx: "MDX",
  yml: "YAML",
  yaml: "YAML",
  toml: "TOML",
};

const SOURCE_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "rs", "go", "java", "kt", "kts",
  "cs", "cpp", "cc", "c", "h", "rb", "php", "swift", "scala", "vue", "svelte",
]);

const IMPORT_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"];

type RawFileLoader = (metadata: RepositoryMetadata, path: string) => Promise<string | null>;

function extensionOf(filePath: string) {
  return path.posix.extname(filePath).slice(1).toLowerCase();
}

function rawDistrictOf(filePath: string) {
  const segments = filePath.split("/").filter(Boolean);
  if (segments.length === 1) return "root";

  const first = segments[0].toLowerCase();
  if (WRAPPER_DIRECTORIES.has(first) && segments.length > 2) return segments[1];
  return segments[0];
}

function isCandidate(item: GitHubTreeItem) {
  if (item.type !== "blob" || !item.size || item.size > 300_000) return false;
  if (SKIPPED_FILES.test(item.path)) return false;
  if (item.path.split("/").some((segment) => EXCLUDED_SEGMENTS.has(segment.toLowerCase()))) return false;
  return Boolean(LANGUAGE_BY_EXTENSION[extensionOf(item.path)]);
}

function filePriority(item: GitHubTreeItem) {
  const extension = extensionOf(item.path);
  const sourceBoost = SOURCE_EXTENSIONS.has(extension) ? 1_000_000 : 0;
  const depthPenalty = item.path.split("/").length * 1_000;
  return sourceBoost + Math.min(item.size ?? 0, 500_000) - depthPenalty;
}

function chooseBalancedFiles(items: GitHubTreeItem[], districtMap: Map<string, string>) {
  const groups = new Map<string, GitHubTreeItem[]>();

  for (const item of items) {
    const district = districtMap.get(rawDistrictOf(item.path)) ?? "other";
    const group = groups.get(district) ?? [];
    group.push(item);
    groups.set(district, group);
  }

  for (const group of groups.values()) {
    group.sort((a, b) => filePriority(b) - filePriority(a));
  }

  const selected: GitHubTreeItem[] = [];
  const orderedGroups = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  let cursor = 0;

  while (selected.length < MAX_VISIBLE_FILES) {
    let added = false;

    for (const [, group] of orderedGroups) {
      const item = group[cursor];
      if (!item) continue;
      selected.push(item);
      added = true;
      if (selected.length === MAX_VISIBLE_FILES) break;
    }

    if (!added) break;
    cursor += 1;
  }

  return selected;
}

function calculateComplexity(content: string) {
  const decisions = content.match(/\b(if|else\s+if|for|while|case|catch|switch|&&|\|\||\?)\b/g)?.length ?? 0;
  const functions = content.match(/\b(function|class)\b|=>/g)?.length ?? 0;
  return Math.max(1, Math.min(100, 1 + decisions + Math.ceil(functions * 0.45)));
}

function importSpecifiers(content: string) {
  const imports: Array<{ specifier: string; type: DependencyEdge["type"] }> = [];
  const patterns: Array<{ regex: RegExp; type: DependencyEdge["type"] }> = [
    { regex: /(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g, type: "import" },
    { regex: /require\(\s*["']([^"']+)["']\s*\)/g, type: "require" },
    { regex: /import\(\s*["']([^"']+)["']\s*\)/g, type: "dynamic-import" },
  ];

  for (const { regex, type } of patterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      imports.push({ specifier: match[1], type });
    }
  }

  return imports;
}

function resolveImport(sourcePath: string, specifier: string, knownPaths: Set<string>) {
  const cleanSpecifier = specifier.split(/[?#]/)[0];
  let base: string;

  if (cleanSpecifier.startsWith("@/") || cleanSpecifier.startsWith("~/")) {
    base = cleanSpecifier.slice(2);
  } else if (cleanSpecifier.startsWith(".")) {
    base = path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), cleanSpecifier));
  } else {
    return null;
  }
  const candidates = [
    base,
    ...IMPORT_EXTENSIONS.map((extension) => `${base}${extension}`),
    ...IMPORT_EXTENSIONS.map((extension) => `${base}/index${extension}`),
  ];

  return candidates.find((candidate) => knownPaths.has(candidate)) ?? null;
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
) {
  const results: R[] = new Array(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await mapper(values[current]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

export async function analyzeRepositoryTree(
  metadata: RepositoryMetadata,
  tree: { tree: GitHubTreeItem[]; truncated: boolean },
  loadRawFile: RawFileLoader,
): Promise<RepositoryAnalysis> {
  const treeFiles = tree.tree.filter((item) => item.type === "blob");
  const candidates = treeFiles.filter(isCandidate);
  const districtCounts = new Map<string, number>();

  for (const item of candidates) {
    const district = rawDistrictOf(item.path);
    districtCounts.set(district, (districtCounts.get(district) ?? 0) + 1);
  }

  const topDistricts = [...districtCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_DISTRICTS)
    .map(([district]) => district);
  const districtMap = new Map<string, string>();

  for (const district of districtCounts.keys()) {
    districtMap.set(district, topDistricts.includes(district) ? district : "other");
  }

  const selectedItems = chooseBalancedFiles(candidates, districtMap);
  const files: RepositoryFile[] = selectedItems.map((item) => {
    const extension = extensionOf(item.path);
    const size = item.size ?? 0;
    const rawDistrict = rawDistrictOf(item.path);

    return {
      id: item.path,
      sha: item.sha,
      name: path.posix.basename(item.path),
      path: item.path,
      extension,
      language: LANGUAGE_BY_EXTENSION[extension] ?? "Texto",
      size,
      lines: Math.max(1, Math.round(size / 38)),
      complexity: Math.max(1, Math.min(35, Math.round(Math.sqrt(size / 80)))),
      codePreview: null,
      district: districtMap.get(rawDistrict) ?? "other",
      dependencies: [],
      dependents: [],
    };
  });

  const knownPaths = new Set(files.map((file) => file.path));
  const analyzable = files
    .filter((file) => ["ts", "tsx", "js", "jsx", "mjs", "cjs"].includes(file.extension))
    .sort((a, b) => b.size - a.size)
    .slice(0, MAX_ANALYZED_SOURCE_FILES);

  const contents = await mapWithConcurrency(analyzable, 6, async (file) => ({
    file,
    content: await loadRawFile(metadata, file.path),
  }));

  const fileByPath = new Map(files.map((file) => [file.path, file]));
  const edgeKeys = new Set<string>();
  const edges: DependencyEdge[] = [];
  let analyzedCount = 0;

  for (const { file, content } of contents) {
    if (!content) continue;
    analyzedCount += 1;
    file.lines = content.split(/\r?\n/).length;
    file.complexity = calculateComplexity(content);
    file.codePreview = content.split(/\r?\n/).slice(0, 14).join("\n").slice(0, 1800);

    for (const imported of importSpecifiers(content)) {
      const targetPath = resolveImport(file.path, imported.specifier, knownPaths);
      if (!targetPath || targetPath === file.path) continue;

      const key = `${file.path}→${targetPath}`;
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      edges.push({
        source: file.path,
        target: targetPath,
        specifier: imported.specifier,
        type: imported.type,
      });
    }
  }

  const dependentSets = new Map<string, Set<string>>();
  for (const edge of edges) {
    fileByPath.get(edge.source)?.dependencies.push(edge.target);
    const dependents = dependentSets.get(edge.target) ?? new Set<string>();
    dependents.add(edge.source);
    dependentSets.set(edge.target, dependents);
  }

  for (const file of files) {
    file.dependents = [...(dependentSets.get(file.path) ?? [])];
  }

  const sourceFileCount = files.filter((file) =>
    ["ts", "tsx", "js", "jsx", "mjs", "cjs"].includes(file.extension),
  ).length;

  return {
    repository: metadata,
    files,
    edges,
    districts: [...new Set(files.map((file) => file.district))],
    diagnostics: {
      totalTreeFiles: treeFiles.length,
      visibleFiles: files.length,
      sourceFilesAnalyzed: analyzedCount,
      dependenciesFound: edges.length,
      truncated: tree.truncated || candidates.length > files.length,
      dependencyMode:
        analyzedCount === 0
          ? "structure-only"
          : analyzedCount >= sourceFileCount
            ? "full"
            : "partial",
    },
  };
}
