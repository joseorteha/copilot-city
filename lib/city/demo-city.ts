import { generateCity } from "@/lib/city/generate-city";
import type { CityModel } from "@/types/city";
import type { DependencyEdge, RepositoryAnalysis, RepositoryFile } from "@/types/repository";

function file(
  path: string,
  district: string,
  lines: number,
  complexity: number,
  language = "TypeScript",
): RepositoryFile {
  const name = path.split("/").at(-1) ?? path;
  const extension = name.split(".").at(-1) ?? "ts";

  return {
    id: path,
    sha: path,
    name,
    path,
    extension,
    language,
    size: lines * 42,
    lines,
    complexity,
    codePreview: null,
    district,
    dependencies: [],
    dependents: [],
  };
}

const files = [
  file("app/page.tsx", "app", 248, 13),
  file("app/layout.tsx", "app", 122, 5),
  file("app/api/analyze/route.ts", "app", 314, 18),
  file("components/CityScene.tsx", "components", 486, 23),
  file("components/Building.tsx", "components", 622, 29),
  file("components/Search.tsx", "components", 218, 11),
  file("components/Inspector.tsx", "components", 276, 14),
  file("lib/github/client.ts", "github", 384, 21),
  file("lib/github/parser.ts", "github", 186, 9),
  file("lib/analyzer/graph.ts", "engine", 534, 31),
  file("lib/city/generator.ts", "engine", 718, 38),
  file("lib/city/layout.ts", "engine", 596, 34),
  file("lib/city/roads.ts", "engine", 292, 17),
  file("tests/analyzer.test.ts", "tests", 344, 15),
  file("tests/layout.test.ts", "tests", 412, 19),
  file("tests/github.test.ts", "tests", 238, 12),
  file("docs/ARCHITECTURE.md", "docs", 468, 3, "Markdown"),
  file("README.md", "docs", 226, 2, "Markdown"),
];

const edges: DependencyEdge[] = [
  {
    source: "app/page.tsx",
    target: "components/CityScene.tsx",
    specifier: "../components/CityScene",
    type: "import",
  },
  {
    source: "components/CityScene.tsx",
    target: "components/Building.tsx",
    specifier: "./Building",
    type: "import",
  },
  {
    source: "app/api/analyze/route.ts",
    target: "lib/github/client.ts",
    specifier: "../../../lib/github/client",
    type: "import",
  },
  {
    source: "app/api/analyze/route.ts",
    target: "lib/analyzer/graph.ts",
    specifier: "../../../lib/analyzer/graph",
    type: "import",
  },
  {
    source: "lib/analyzer/graph.ts",
    target: "lib/city/generator.ts",
    specifier: "../city/generator",
    type: "import",
  },
  { source: "lib/city/generator.ts", target: "lib/city/layout.ts", specifier: "./layout", type: "import" },
  { source: "lib/city/generator.ts", target: "lib/city/roads.ts", specifier: "./roads", type: "import" },
  {
    source: "tests/layout.test.ts",
    target: "lib/city/layout.ts",
    specifier: "../lib/city/layout",
    type: "import",
  },
  {
    source: "tests/analyzer.test.ts",
    target: "lib/analyzer/graph.ts",
    specifier: "../lib/analyzer/graph",
    type: "import",
  },
  {
    source: "tests/github.test.ts",
    target: "lib/github/client.ts",
    specifier: "../lib/github/client",
    type: "import",
  },
];

// An offline software system: eight neighbourhoods, real graph topology and varied scales.
const neighbourhoods = [
  {
    district: "frontend",
    prefix: "frontend",
    names: [
      "Dashboard",
      "Navigation",
      "Editor",
      "Canvas",
      "Search",
      "Inspector",
      "Toolbar",
      "Settings",
      "Timeline",
      "FileTree",
      "Shortcuts",
      "Theme",
    ],
  },
  {
    district: "services",
    prefix: "services",
    names: [
      "gateway",
      "router",
      "repository",
      "analysis",
      "export",
      "events",
      "scheduler",
      "worker",
      "queue",
      "notifications",
    ],
  },
  {
    district: "data",
    prefix: "data/schema",
    names: [
      "repository",
      "graph",
      "storage",
      "cache",
      "migration",
      "index",
      "query",
      "relations",
      "snapshot",
      "versions",
    ],
  },
  {
    district: "security",
    prefix: "auth",
    names: ["permissions", "session", "policy", "tokens", "access", "roles"],
  },
  {
    district: "tests",
    prefix: "tests",
    names: [
      "gateway.test",
      "storage.test",
      "permissions.test",
      "export.test",
      "navigation.test",
      "graph.test",
      "worker.test",
      "integration.test",
    ],
  },
  {
    district: "docs",
    prefix: "docs",
    names: ["architecture", "onboarding", "contributing", "api", "design-system", "deployment"],
  },
];
for (const [groupIndex, group] of neighbourhoods.entries()) {
  for (const [index, name] of group.names.entries()) {
    const extension = group.district === "docs" ? "md" : group.district === "frontend" ? "tsx" : "ts";
    const path = `${group.prefix}/${name}.${extension}`;
    files.push(
      file(
        path,
        group.district,
        55 + ((index * 173 + groupIndex * 97) % 1100),
        group.district === "docs" ? 2 : 3 + ((index * 7 + groupIndex * 3) % 65),
        extension === "md" ? "Markdown" : "TypeScript",
      ),
    );
    const target = index ? `${group.prefix}/${group.names[0]}.${extension}` : "lib/city/generator.ts";
    edges.push({ source: path, target, specifier: target, type: "import" });
    if (index % 3 === 0 && groupIndex > 0) {
      const upstream = neighbourhoods[groupIndex - 1];
      const other = `${upstream.prefix}/${upstream.names[0]}.${upstream.district === "frontend" ? "tsx" : "ts"}`;
      edges.push({ source: path, target: other, specifier: other, type: "import" });
    }
  }
}

for (const edge of edges) {
  files.find((candidate) => candidate.id === edge.source)?.dependencies.push(edge.target);
  files.find((candidate) => candidate.id === edge.target)?.dependents.push(edge.source);
}

const analysis: RepositoryAnalysis = {
  repository: {
    owner: "copilot-city",
    name: "urban-demo",
    fullName: "copilot-city/urban-demo",
    description: "Vista previa arquitectónica de una ciudad generada desde código.",
    defaultBranch: "main",
    htmlUrl: "https://github.com",
    stars: 128,
    forks: 14,
    primaryLanguage: "TypeScript",
    sizeKb: 4812,
    updatedAt: new Date(0).toISOString(),
  },
  files,
  edges,
  districts: [...new Set(files.map((candidate) => candidate.district))],
  diagnostics: {
    totalTreeFiles: files.length,
    visibleFiles: files.length,
    sourceFilesAnalyzed: files.filter((candidate) => candidate.language === "TypeScript").length,
    dependenciesFound: edges.length,
    truncated: false,
    dependencyMode: "full",
  },
};

let cached: CityModel | null = null;

/**
 * Built on first use rather than at import time: generating it runs PageRank, the district
 * packing and a route search per dependency, and that used to happen on the main thread
 * before the first frame could paint.
 */
export function getDemoCity() {
  cached ??= generateCity(analysis);
  return cached;
}
