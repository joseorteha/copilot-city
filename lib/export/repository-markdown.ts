import path from "node:path";

import type { GitHubTreeItem } from "@/lib/github/github-client";
import type { RepositoryMetadata } from "@/types/repository";

const MAX_FILES = 180;
/** Stays under the route's 60 s ceiling: 180 downloads at concurrency 10 can exceed it. */
const TIME_BUDGET_MS = 45_000;
const MAX_TOTAL_CHARACTERS = 2_400_000;
const MAX_FILE_BYTES = 140_000;
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
const TEXT_EXTENSIONS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "py",
  "rs",
  "go",
  "java",
  "kt",
  "kts",
  "cs",
  "cpp",
  "cc",
  "c",
  "h",
  "rb",
  "php",
  "swift",
  "scala",
  "vue",
  "svelte",
  "css",
  "scss",
  "sass",
  "less",
  "html",
  "sql",
  "graphql",
  "gql",
  "sh",
  "bash",
  "ps1",
  "bat",
  "cmd",
  "dockerfile",
  "json",
  "jsonc",
  "md",
  "mdx",
  "txt",
  "yml",
  "yaml",
  "toml",
  "xml",
  "ini",
  "cfg",
  "conf",
  "properties",
  "gradle",
  "lock",
]);
const SPECIAL_TEXT_FILES =
  /(^|\/)(readme|license|changelog|contributing|dockerfile|makefile|procfile|gemfile|rakefile|package\.json|tsconfig(?:\.[^.]+)?\.json)$/i;
const SENSITIVE_PATH =
  /(^|\/)(?:\.env(?:\..*)?|\.npmrc|\.pypirc|id_(?:rsa|dsa|ecdsa|ed25519)|.*\.(?:pem|key|p12|pfx)|(?:secrets?|credentials?)(?:\.[^/]*)?)$/i;
const GENERATED_FILE =
  /(?:\.min\.(?:js|css)$|\.map$|\.snap$|package-lock\.json$|pnpm-lock\.yaml$|yarn\.lock$)/i;

export interface MarkdownExportResult {
  markdown: string;
  filename: string;
  filesIncluded: number;
  filesSkipped: number;
  estimatedTokens: number;
  truncated: boolean;
}

type RawLoader = (metadata: RepositoryMetadata, path: string) => Promise<string | null>;

function isTextFile(item: GitHubTreeItem) {
  if (item.type !== "blob" || !item.size || item.size > MAX_FILE_BYTES) return false;
  if (item.path.split("/").some((segment) => EXCLUDED_SEGMENTS.has(segment.toLowerCase()))) return false;
  if (SENSITIVE_PATH.test(item.path) || GENERATED_FILE.test(item.path)) return false;
  const extension = path.posix.extname(item.path).slice(1).toLowerCase();
  return TEXT_EXTENSIONS.has(extension) || SPECIAL_TEXT_FILES.test(item.path);
}

function priority(item: GitHubTreeItem) {
  const name = path.posix.basename(item.path).toLowerCase();
  const extension = path.posix.extname(item.path).slice(1).toLowerCase();
  const depth = item.path.split("/").length;
  let score = 0;
  if (/^(readme|package\.json|pyproject\.toml|cargo\.toml|go\.mod|pom\.xml|build\.gradle)/.test(name))
    score += 1_000_000;
  if (
    [
      "ts",
      "tsx",
      "js",
      "jsx",
      "py",
      "rs",
      "go",
      "java",
      "kt",
      "cs",
      "cpp",
      "c",
      "rb",
      "php",
      "swift",
    ].includes(extension)
  )
    score += 500_000;
  if (["md", "mdx", "json", "yml", "yaml", "toml"].includes(extension)) score += 200_000;
  return score + Math.min(item.size ?? 0, 150_000) - depth * 500;
}

function directoryTree(paths: string[]) {
  const root: Record<string, unknown> = {};
  for (const filePath of paths) {
    let cursor = root;
    for (const segment of filePath.split("/")) {
      cursor[segment] ??= {};
      cursor = cursor[segment] as Record<string, unknown>;
    }
  }

  const lines: string[] = [];
  function walk(node: Record<string, unknown>, prefix = "") {
    const entries = Object.entries(node).sort(([a, av], [b, bv]) => {
      const aDir = Object.keys(av as object).length > 0;
      const bDir = Object.keys(bv as object).length > 0;
      return Number(bDir) - Number(aDir) || a.localeCompare(b);
    });
    entries.forEach(([name, child], index) => {
      const last = index === entries.length - 1;
      const children = child as Record<string, unknown>;
      const directory = Object.keys(children).length > 0;
      lines.push(`${prefix}${last ? "└──" : "├──"} ${name}${directory ? "/" : ""}`);
      if (directory) walk(children, `${prefix}${last ? "    " : "│   "}`);
    });
  }
  walk(root);
  return lines.join("\n");
}

function codeFence(content: string) {
  const runs = content.match(/`+/g) ?? [];
  const size = Math.max(3, ...runs.map((run) => run.length + 1));
  return "`".repeat(size);
}

function languageFor(filePath: string) {
  const extension = path.posix.extname(filePath).slice(1).toLowerCase();
  const aliases: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    py: "python",
    rb: "ruby",
    rs: "rust",
    cs: "csharp",
    sh: "bash",
    yml: "yaml",
    md: "markdown",
  };
  return aliases[extension] ?? extension;
}

/**
 * Stops queueing work once the deadline passes and returns what it has. A partial document
 * that says it is partial beats a 504 with nothing in it.
 */
async function concurrentMap<T, R>(
  values: T[],
  concurrency: number,
  deadline: number,
  task: (value: T) => Promise<R>,
) {
  const results = new Array<R | undefined>(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      if (Date.now() > deadline) return;
      const index = cursor++;
      results[index] = await task(values[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

export async function exportRepositoryMarkdown(
  metadata: RepositoryMetadata,
  tree: { tree: GitHubTreeItem[]; truncated: boolean },
  loadRawFile: RawLoader,
): Promise<MarkdownExportResult> {
  const eligible = tree.tree
    .filter(isTextFile)
    .sort((a, b) => priority(b) - priority(a) || a.path.localeCompare(b.path));
  const selected = eligible.slice(0, MAX_FILES);
  const deadline = Date.now() + TIME_BUDGET_MS;
  const loaded = await concurrentMap(selected, 16, deadline, async (item) => ({
    item,
    content: await loadRawFile(metadata, item.path),
  }));
  const sections: string[] = [];
  let characters = 0;
  let filesIncluded = 0;

  for (const entry of loaded) {
    if (!entry) continue;
    const { item, content } = entry;
    if (!content || content.includes("\u0000")) continue;
    const nextSize = content.length + item.path.length + 80;
    if (characters + nextSize > MAX_TOTAL_CHARACTERS) break;
    const fence = codeFence(content);
    sections.push(
      `## \`${item.path}\`\n\n${fence}${languageFor(item.path)}\n${content.replace(/\s+$/, "")}\n${fence}`,
    );
    characters += nextSize;
    filesIncluded += 1;
  }

  const truncated = tree.truncated || eligible.length > filesIncluded;
  const generatedAt = new Date().toISOString();
  const treeText = directoryTree(tree.tree.filter((item) => item.type === "blob").map((item) => item.path));
  const markdown = `---\nrepository: ${metadata.fullName}\nbranch: ${metadata.defaultBranch}\nsource: ${metadata.htmlUrl}\ngenerated_at: ${generatedAt}\nfiles_included: ${filesIncluded}\ntruncated: ${truncated}\n---\n\n# ${metadata.fullName} — contexto para IA\n\n> Generado por Copilot City. Este documento reúne la estructura y el contenido textual del repositorio para utilizarlo como contexto en asistentes de IA.\n\n## Resumen\n\n- **Repositorio:** [${metadata.fullName}](${metadata.htmlUrl})\n- **Rama:** \`${metadata.defaultBranch}\`\n- **Lenguaje principal:** ${metadata.primaryLanguage ?? "No identificado"}\n- **Archivos incluidos:** ${filesIncluded} de ${eligible.length} archivos textuales compatibles\n- **Descripción:** ${metadata.description ?? "Sin descripción"}\n${truncated ? "- **Nota:** La salida fue limitada para mantener un tamaño seguro y útil como contexto.\n" : ""}\n## Estructura del repositorio\n\n\`\`\`text\n${treeText}\n\`\`\`\n\n# Contenido de archivos\n\n${sections.join("\n\n---\n\n")}\n`;

  return {
    markdown,
    filename: `${metadata.owner}-${metadata.name}-context.md`.replace(/[^a-zA-Z0-9._-]/g, "-"),
    filesIncluded,
    filesSkipped: Math.max(0, eligible.length - filesIncluded),
    estimatedTokens: Math.ceil(markdown.length / 4),
    truncated,
  };
}
