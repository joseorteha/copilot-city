import { describe, expect, it } from "vitest";

import { analyzeRepositoryTree } from "@/lib/analyzer/analyze-repository";
import type { GitHubTreeItem } from "@/lib/github/github-client";
import type { RepositoryMetadata } from "@/types/repository";

const metadata: RepositoryMetadata = {
  owner: "test",
  name: "fixture",
  fullName: "test/fixture",
  description: null,
  defaultBranch: "main",
  htmlUrl: "https://github.com/test/fixture",
  stars: 0,
  forks: 0,
  primaryLanguage: "TypeScript",
  sizeKb: 1,
  updatedAt: new Date(0).toISOString(),
};

function blob(path: string, size = 2400): GitHubTreeItem {
  return { path, mode: "100644", type: "blob", sha: path, size, url: "" };
}

const sources: Record<string, string> = {
  "src/app/page.tsx": `
    import { Button } from "@/components/button";
    import helpers from "./helpers";
    const legacy = require("../shared/legacy");
    const lazy = () => import("@/components/chart");
    export default function Page() { return null; }
  `,
  "src/components/button.tsx": "export const Button = () => null;",
  "src/components/chart.tsx": "export const Chart = () => null;",
  "src/components/index.ts": "export * from './button';",
  "src/app/helpers.ts": "export const helper = 1;",
  "src/shared/legacy.js": "module.exports = {};",
};

const tree = {
  tree: [
    ...Object.keys(sources).map((path) => blob(path)),
    blob("node_modules/react/index.js"),
    blob("dist/bundle.js"),
    blob("public/logo.png"),
    blob("package-lock.json"),
    blob("src/app/huge.ts", 900_000),
  ],
  truncated: false,
};

const loadRawFile = async (_: RepositoryMetadata, path: string) => sources[path] ?? null;

describe("analyzeRepositoryTree", () => {
  it("excludes dependencies, build output, binaries and lockfiles", async () => {
    const analysis = await analyzeRepositoryTree(metadata, tree, loadRawFile);
    const paths = analysis.files.map((file) => file.path);
    expect(paths).not.toContain("node_modules/react/index.js");
    expect(paths).not.toContain("dist/bundle.js");
    expect(paths).not.toContain("public/logo.png");
    expect(paths).not.toContain("package-lock.json");
    // Over the per-file size ceiling.
    expect(paths).not.toContain("src/app/huge.ts");
  });

  it("unwraps src/ so districts describe the actual architecture", async () => {
    const analysis = await analyzeRepositoryTree(metadata, tree, loadRawFile);
    const page = analysis.files.find((file) => file.path === "src/app/page.tsx");
    expect(page?.district).toBe("app");
  });

  it("resolves alias, relative, require and dynamic imports", async () => {
    const analysis = await analyzeRepositoryTree(metadata, tree, loadRawFile);
    const targets = analysis.edges
      .filter((edge) => edge.source === "src/app/page.tsx")
      .map((edge) => edge.target)
      .sort();

    expect(targets).toEqual([
      "src/app/helpers.ts",
      "src/components/button.tsx",
      "src/components/chart.tsx",
      "src/shared/legacy.js",
    ]);
  });

  it("records the inverse relationship on the target", async () => {
    const analysis = await analyzeRepositoryTree(metadata, tree, loadRawFile);
    const button = analysis.files.find((file) => file.path === "src/components/button.tsx");
    expect(button?.dependents).toContain("src/app/page.tsx");
  });

  it("reports structure-only when no source could be read", async () => {
    const analysis = await analyzeRepositoryTree(metadata, tree, async () => null);
    expect(analysis.diagnostics.dependencyMode).toBe("structure-only");
    expect(analysis.edges).toHaveLength(0);
    expect(analysis.files.length).toBeGreaterThan(0);
  });
});
