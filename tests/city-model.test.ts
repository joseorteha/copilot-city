import { describe, expect, it } from "vitest";

import { generateCity } from "@/lib/city/generate-city";
import { getDemoCity } from "@/lib/city/demo-city";
import { graphCentrality } from "@/lib/city/graph";
import { DISTRICT_GAP } from "@/lib/city/layout";
import { terrainHeight } from "@/lib/city/terrain";
import type { DependencyEdge, RepositoryAnalysis, RepositoryFile } from "@/types/repository";

function file(path: string, district: string, extra: Partial<RepositoryFile> = {}): RepositoryFile {
  return {
    id: path,
    sha: path,
    name: path.split("/").at(-1) ?? path,
    path,
    extension: path.split(".").at(-1) ?? "ts",
    language: "TypeScript",
    size: 4200,
    lines: 120,
    complexity: 9,
    codePreview: null,
    district,
    dependencies: [],
    dependents: [],
    ...extra,
  };
}

function analysisOf(files: RepositoryFile[], edges: DependencyEdge[]): RepositoryAnalysis {
  for (const edge of edges) {
    files.find((candidate) => candidate.id === edge.source)?.dependencies.push(edge.target);
    files.find((candidate) => candidate.id === edge.target)?.dependents.push(edge.source);
  }
  return {
    repository: {
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
    },
    files,
    edges,
    districts: [...new Set(files.map((candidate) => candidate.district))],
    diagnostics: {
      totalTreeFiles: files.length,
      visibleFiles: files.length,
      sourceFilesAnalyzed: files.length,
      dependenciesFound: edges.length,
      truncated: false,
      dependencyMode: "full",
    },
  };
}

const files = [
  ...Array.from({ length: 9 }, (_, index) => file(`app/page-${index}.tsx`, "app")),
  ...Array.from({ length: 7 }, (_, index) => file(`lib/module-${index}.ts`, "lib")),
  ...Array.from({ length: 5 }, (_, index) => file(`tests/case-${index}.test.ts`, "tests")),
];

const edges: DependencyEdge[] = [
  // Five pages depend on module-0, and module-0 depends on something itself, so it is not a
  // dangling node whose rank leaks away every iteration.
  ...Array.from({ length: 5 }, (_, index) => ({
    source: `app/page-${index}.tsx`,
    target: "lib/module-0.ts",
    specifier: "@/lib/module-0",
    type: "import" as const,
  })),
  { source: "tests/case-0.test.ts", target: "lib/module-0.ts", specifier: "@/lib/module-0", type: "import" },
  { source: "lib/module-0.ts", target: "lib/module-3.ts", specifier: "./module-3", type: "import" },
  // A deliberate two-node cycle, off to one side.
  { source: "lib/module-1.ts", target: "lib/module-2.ts", specifier: "./module-2", type: "import" },
  { source: "lib/module-2.ts", target: "lib/module-1.ts", specifier: "./module-1", type: "import" },
];

const city = generateCity(analysisOf(files, edges));

function roadIntersectsBuilding(road: (typeof city.roads)[number], building: (typeof city.buildings)[number]) {
  const margin=road.width/2+.18;
  const minX=building.position[0]-building.width/2-margin, maxX=building.position[0]+building.width/2+margin;
  const minZ=building.position[2]-building.depth/2-margin, maxZ=building.position[2]+building.depth/2+margin;
  let enter=0,leave=1;
  for(const [start,delta,min,max] of [[road.from[0],road.to[0]-road.from[0],minX,maxX],[road.from[1],road.to[1]-road.from[1],minZ,maxZ]]) {
    if(Math.abs(delta)<1e-8) { if(start<min||start>max) return false; }
    else { const a=(min-start)/delta,b=(max-start)/delta; enter=Math.max(enter,Math.min(a,b)); leave=Math.min(leave,Math.max(a,b)); }
  }
  return enter<=leave && leave>=0 && enter<=1;
}

describe("generateCity", () => {
  it("gives every file exactly one building", () => {
    expect(city.buildings).toHaveLength(files.length);
    expect(new Set(city.buildings.map((building) => building.nodeId)).size).toBe(files.length);
  });

  it("never places two buildings on the same lot", () => {
    const lots = city.buildings.map(
      (building) => `${building.position[0].toFixed(3)},${building.position[2].toFixed(3)}`,
    );
    expect(new Set(lots).size).toBe(lots.length);
  });

  it("keeps districts clear of one another", () => {
    for (const a of city.districts) {
      for (const b of city.districts) {
        if (a.id === b.id) continue;
        const apart =
          Math.abs(a.position[0] - b.position[0]) >= (a.size[0] + b.size[0]) / 2 + DISTRICT_GAP ||
          Math.abs(a.position[1] - b.position[1]) >= (a.size[1] + b.size[1]) / 2 + DISTRICT_GAP;
        expect(apart, `${a.id} overlaps ${b.id}`).toBe(true);
      }
    }
  });

  it("finds the deliberate dependency cycle", () => {
    const cycle = city.cycles.find(
      (candidate) =>
        candidate.includes("building:lib/module-1.ts") && candidate.includes("building:lib/module-2.ts"),
    );
    expect(cycle).toBeDefined();
  });

  it("elects the most depended-upon module as the core", () => {
    expect(city.coreBuildingId).toBe("building:lib/module-0.ts");
  });

  it("routes every connection through at least one road node", () => {
    expect(city.connections).toHaveLength(edges.length);
    for (const connection of city.connections) expect(connection.route.length).toBeGreaterThanOrEqual(2);
  });

  it("never sends a road through a building footprint", () => {
    for(const road of city.roads) for(const building of city.buildings) {
      expect(roadIntersectsBuilding(road,building),`${road.id} crosses ${building.id}`).toBe(false);
    }
    const demo=getDemoCity();
    for(const road of demo.roads) for(const building of demo.buildings) {
      expect(roadIntersectsBuilding(road,building),`demo: ${road.id} crosses ${building.id}`).toBe(false);
    }
  });

  it("is deterministic", () => {
    const again = generateCity(
      analysisOf(
        files.map((candidate) => ({ ...candidate, dependencies: [], dependents: [] })),
        edges.map((edge) => ({ ...edge })),
      ),
    );
    expect(again.buildings.map((building) => building.position)).toEqual(
      city.buildings.map((building) => building.position),
    );
  });
});

describe("graphCentrality", () => {
  it("ranks the shared dependency above its dependents", () => {
    const ranks = graphCentrality(
      analysisOf(
        files.map((candidate) => ({ ...candidate, dependencies: [], dependents: [] })),
        edges.map((edge) => ({ ...edge })),
      ),
    );
    expect(ranks.get("lib/module-0.ts")!).toBeGreaterThan(ranks.get("app/page-0.tsx")!);
  });
});

describe("terrainHeight", () => {
  it("keeps the ground flat under a district and lets it roll away from one", () => {
    const district = city.districts[0];
    const inside = terrainHeight(district.position[0], district.position[1], city.districts);
    expect(inside).toBeCloseTo(-0.12, 5);

    const faraway = terrainHeight(district.position[0] + 400, district.position[1] + 400, city.districts);
    expect(faraway).toBeLessThan(inside);
  });
});
