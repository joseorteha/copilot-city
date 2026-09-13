import type {
  BuildingTone,
  CityBuilding,
  CityConnection,
  CityDistrict,
  CityModel,
  CityRoad,
  DistrictPurpose,
} from "@/types/city";
import { graphCentrality, hashString } from "./graph";
import {
  arrangeDistricts,
  DISTRICT_PADDING,
  lotPositions,
  SPACING_X,
  SPACING_Z,
  type DistrictPlan,
} from "./layout";
import { classifyBuilding } from "./buildings";
import { createRoads, roadRouter } from "./roads";
import type { RepositoryAnalysis, RepositoryFile, RepositoryInsights } from "@/types/repository";

const PURPOSE_STYLE: Record<DistrictPurpose, { color: string; tones: BuildingTone[] }> = {
  frontend: { color: "#7f9699", tones: ["slate", "concrete"] },
  services: { color: "#829487", tones: ["concrete", "stone"] },
  data: { color: "#a18e6d", tones: ["sand", "brick"] },
  tests: { color: "#8c8498", tones: ["slate", "stone"] },
  docs: { color: "#a79b7e", tones: ["sand", "stone"] },
  infrastructure: { color: "#918477", tones: ["brick", "concrete"] },
  general: { color: "#89928a", tones: ["stone", "slate", "concrete"] },
};

function titleCase(value: string) {
  if (value === "root") return "Raíz";
  if (value === "other") return "Otros";

  return value.replace(/[-_.]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function districtPurpose(value: string): DistrictPurpose {
  const name = value.toLowerCase();
  if (/test|spec|e2e|playwright/.test(name)) return "tests";
  if (/doc|guide|example|story/.test(name)) return "docs";
  if (/data|database|db|schema|storage|migration|model/.test(name)) return "data";
  if (/api|service|server|backend|route|auth/.test(name)) return "services";
  if (/component|page|view|ui|web|client|frontend|app/.test(name)) return "frontend";
  if (/script|config|infra|deploy|ci|public|asset|tool/.test(name)) return "infrastructure";
  return "general";
}

function createDistrictPlans(analysis: RepositoryAnalysis) {
  const filesByDistrict = new Map<string, RepositoryFile[]>();

  for (const file of analysis.files) {
    const files = filesByDistrict.get(file.district) ?? [];
    files.push(file);
    filesByDistrict.set(file.district, files);
  }

  const plans: DistrictPlan[] = [...filesByDistrict.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([district, files]) => {
      const purpose = districtPurpose(district);
      const columns = files.length > 18 ? 6 : files.length > 5 ? 4 : 2;
      const rows = Math.ceil((files.length + 2) / columns);

      return {
        id: district,
        name: titleCase(district),
        position: [0, 0],
        size: [columns * SPACING_X + DISTRICT_PADDING, rows * SPACING_Z + DISTRICT_PADDING],
        color: PURPOSE_STYLE[purpose].color,
        buildingCount: files.length,
        purpose,
        plazaPosition: [0, 0],
        columns,
        rows,
        files,
      };
    });

  arrangeDistricts(plans, analysis, graphCentrality(analysis));
  return plans;
}

function importanceScores(files: RepositoryFile[]) {
  const maxSize = Math.max(...files.map((file) => Math.log1p(file.size)), 1);
  const maxComplexity = Math.max(...files.map((file) => file.complexity), 1);
  const maxDependents = Math.max(...files.map((file) => file.dependents.length), 1);
  const maxDependencies = Math.max(...files.map((file) => file.dependencies.length), 1);

  return new Map(
    files.map((file) => {
      const size = Math.log1p(file.size) / maxSize;
      const complexity = file.complexity / maxComplexity;
      const dependents = file.dependents.length / maxDependents;
      const dependencies = file.dependencies.length / maxDependencies;
      const importance = size * 0.36 + complexity * 0.23 + dependents * 0.3 + dependencies * 0.11;
      return [file.id, Math.min(1, importance)];
    }),
  );
}

function createBuildings(plans: DistrictPlan[], analysis: RepositoryAnalysis, insights: RepositoryInsights) {
  const scores = importanceScores(analysis.files);
  const centralities = graphCentrality(analysis);
  for (const file of analysis.files)
    scores.set(file.id, (scores.get(file.id) ?? 0) * 0.45 + (centralities.get(file.id) ?? 0) * 0.55);
  const landmarkIds = new Set(
    [...analysis.files]
      .sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0))
      .slice(0, Math.max(1, Math.min(4, Math.ceil(analysis.files.length * 0.025))))
      .map((file) => file.id),
  );
  const buildings: CityBuilding[] = [];

  const neighborhoodFor = (file: RepositoryFile, districtId: string) => {
    const parts = file.path.split("/").filter(Boolean);
    const districtIndex = parts.lastIndexOf(districtId);
    const candidate = parts[districtIndex + 1];
    if (!candidate || candidate.includes(".")) return { id: districtId, name: "Centro" };
    return { id: `${districtId}/${candidate}`, name: titleCase(candidate) };
  };

  plans.forEach((plan) => {
    const freeLots = lotPositions(plan).filter(
      ([x, z]) => x !== plan.plazaPosition[0] || z !== plan.plazaPosition[1],
    );
    const groups = new Map<string, { name: string; files: RepositoryFile[] }>();
    for (const file of plan.files) {
      const neighborhood = neighborhoodFor(file, plan.id);
      const group = groups.get(neighborhood.id) ?? { name: neighborhood.name, files: [] };
      group.files.push(file);
      groups.set(neighborhood.id, group);
    }
    const neighborhoods = [...groups.entries()]
      .map(([id, group]) => ({
        id,
        name: group.name,
        files: group.files.sort(
          (a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) || a.path.localeCompare(b.path),
        ),
        importance: Math.max(...group.files.map((file) => scores.get(file.id) ?? 0)),
      }))
      .sort((a, b) => b.importance - a.importance || a.id.localeCompare(b.id));

    const placements: Array<{
      file: RepositoryFile;
      lot: [number, number];
      neighborhood: { id: string; name: string };
    }> = [];
    for (const neighborhood of neighborhoods) {
      const seed = [...freeLots].sort(
        (a, b) =>
          Math.hypot(a[0] - plan.plazaPosition[0], a[1] - plan.plazaPosition[1]) -
            Math.hypot(b[0] - plan.plazaPosition[0], b[1] - plan.plazaPosition[1]) ||
          a[1] - b[1] ||
          a[0] - b[0],
      )[0];
      if (!seed) continue;
      const neighborhoodLots = [...freeLots]
        .sort(
          (a, b) =>
            Math.hypot(a[0] - seed[0], a[1] - seed[1]) - Math.hypot(b[0] - seed[0], b[1] - seed[1]) ||
            Math.hypot(a[0] - plan.plazaPosition[0], a[1] - plan.plazaPosition[1]) -
              Math.hypot(b[0] - plan.plazaPosition[0], b[1] - plan.plazaPosition[1]),
        )
        .slice(0, neighborhood.files.length)
        .sort(
          (a, b) =>
            Math.hypot(a[0] - plan.plazaPosition[0], a[1] - plan.plazaPosition[1]) -
            Math.hypot(b[0] - plan.plazaPosition[0], b[1] - plan.plazaPosition[1]),
        );
      neighborhood.files.forEach((file, index) => {
        const lot = neighborhoodLots[index];
        if (lot) placements.push({ file, lot, neighborhood });
      });
      for (const lot of neighborhoodLots) {
        const index = freeLots.indexOf(lot);
        if (index >= 0) freeLots.splice(index, 1);
      }
    }

    placements.forEach(({ file, lot, neighborhood }) => {
      const hash = hashString(file.path);
      const importance = scores.get(file.id) ?? 0;
      const isLandmark = landmarkIds.has(file.id);
      const width = (2.75 + ((hash & 255) / 255) * 1.15) * (isLandmark ? 1.22 : 1);
      const depth = (2.9 + (((hash >>> 8) & 255) / 255) * 1.05) * (isLandmark ? 1.12 : 1);
      const centrality = centralities.get(file.id) ?? 0;
      const variant = classifyBuilding(file, centrality, isLandmark);
      const lowRise = ["data-center", "laboratory", "library", "industrial", "security"].includes(variant);
      const floors = lowRise
        ? 2 + (hash % 2)
        : isLandmark
          ? 9 + Math.round(importance * 4)
          : Math.max(2, Math.min(10, 2 + Math.round(importance * 7)));
      const [x, z] = lot;
      const fileChanges = insights.commits
        .flatMap((commit) => commit.files.map((change) => ({ commit, change })))
        .filter(({ change }) => change.path === file.path);
      const additions = fileChanges.reduce((sum, item) => sum + item.change.additions, 0);
      const deletions = fileChanges.reduce((sum, item) => sum + item.change.deletions, 0);
      const authorCounts = new Map<string, number>();
      for (const item of fileChanges)
        authorCounts.set(item.commit.author, (authorCounts.get(item.commit.author) ?? 0) + 1);
      const primaryAuthor = [...authorCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const recentChanges = fileChanges.length;
      const changePressure = Math.min(1, recentChanges / Math.max(1, insights.commits.length * 0.5));
      const risk = Math.min(1, importance * 0.44 + (file.complexity / 100) * 0.28 + changePressure * 0.28);
      const dates = fileChanges.map((item) => item.commit.date).sort();

      buildings.push({
        id: `building:${file.id}`,
        nodeId: file.id,
        name: file.name,
        path: file.path,
        districtId: plan.id,
        neighborhoodId: neighborhood.id,
        neighborhoodName: neighborhood.name,
        position: [x, 0.08, z],
        // Half the lots turn their entrance to the opposite street, plus a few degrees of
        // deterministic jitter: enough to break the grid without overlapping a neighbour.
        rotation: (hash & 1 ? Math.PI : 0) + (((hash >>> 16) & 255) / 255 - 0.5) * 0.09,
        width,
        depth,
        height: floors * 1.08,
        floors,
        variant,
        tone: PURPOSE_STYLE[plan.purpose].tones[hash % PURPOSE_STYLE[plan.purpose].tones.length],
        importance,
        centrality,
        detailSeed: hash,
        isLandmark,
        codePreview: file.codePreview,
        metrics: {
          size: file.size,
          lines: file.lines,
          complexity: file.complexity,
          dependencies: file.dependencies.length,
          dependents: file.dependents.length,
          language: file.language,
          recentChanges,
          additions,
          deletions,
          risk,
          lastChangedAt: dates.at(-1) ?? null,
          primaryAuthor,
          introducedAt: fileChanges.find((item) => item.change.status === "added")?.commit.date ?? null,
        },
      });
    });
  });

  return buildings;
}

function createConnections(
  buildings: CityBuilding[],
  analysis: RepositoryAnalysis,
  roads: CityRoad[],
): CityConnection[] {
  const route = roadRouter(roads);
  const buildingByNode = new Map(buildings.map((building) => [building.nodeId, building]));
  return analysis.edges.flatMap((edge, index) => {
    const source = buildingByNode.get(edge.source);
    const target = buildingByNode.get(edge.target);
    if (!source || !target) return [];
    return [
      {
        id: `connection:${index}:${edge.source}:${edge.target}`,
        sourceBuildingId: source.id,
        targetBuildingId: target.id,
        source: [source.position[0], source.position[2]],
        target: [target.position[0], target.position[2]],
        specifier: edge.specifier,
        type: edge.type,
        crossDistrict: source.districtId !== target.districtId,
        route: route(
          [source.position[0], source.position[2]],
          [target.position[0], target.position[2]],
          source.districtId,
          target.districtId,
        ),
      } satisfies CityConnection,
    ];
  });
}

function findCycles(analysis: RepositoryAnalysis) {
  const adjacency = new Map<string, string[]>();
  for (const edge of analysis.edges)
    adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target]);
  const indexByNode = new Map<string, number>();
  const lowLink = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const cycles: string[][] = [];
  let index = 0;

  function visit(node: string) {
    indexByNode.set(node, index);
    lowLink.set(node, index);
    index += 1;
    stack.push(node);
    onStack.add(node);

    for (const target of adjacency.get(node) ?? []) {
      if (!indexByNode.has(target)) {
        visit(target);
        lowLink.set(node, Math.min(lowLink.get(node) ?? 0, lowLink.get(target) ?? 0));
      } else if (onStack.has(target)) {
        lowLink.set(node, Math.min(lowLink.get(node) ?? 0, indexByNode.get(target) ?? 0));
      }
    }

    if (lowLink.get(node) !== indexByNode.get(node)) return;
    const component: string[] = [];
    let current = "";
    do {
      current = stack.pop() ?? "";
      onStack.delete(current);
      if (current) component.push(`building:${current}`);
    } while (current !== node && stack.length);
    if (component.length > 1) cycles.push(component);
  }

  for (const file of analysis.files) if (!indexByNode.has(file.id)) visit(file.id);
  return cycles.sort((a, b) => b.length - a.length).slice(0, 12);
}

export function generateCity(
  analysis: RepositoryAnalysis,
  insights: RepositoryInsights = {
    commits: [],
    pullRequests: [],
    contributors: [],
    ci: null,
    degraded: null,
  },
): CityModel {
  const plans = createDistrictPlans(analysis);
  const districts: CityDistrict[] = plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    position: plan.position,
    size: plan.size,
    color: plan.color,
    buildingCount: plan.buildingCount,
    purpose: plan.purpose,
    plazaPosition: plan.plazaPosition,
  }));
  const buildings = createBuildings(plans, analysis, insights);
  const roads = createRoads(plans, analysis);
  const connections = createConnections(buildings, analysis, roads);
  const coreBuilding = [...buildings].sort((a, b) => b.importance - a.importance)[0];

  const minX = Math.min(...districts.map((district) => district.position[0] - district.size[0] / 2), -12);
  const maxX = Math.max(...districts.map((district) => district.position[0] + district.size[0] / 2), 12);
  const minZ = Math.min(...districts.map((district) => district.position[1] - district.size[1] / 2), -12);
  const maxZ = Math.max(...districts.map((district) => district.position[1] + district.size[1] / 2), 12);
  const width = maxX - minX + 10;
  const depth = maxZ - minZ + 10;

  return {
    repository: analysis.repository,
    diagnostics: analysis.diagnostics,
    buildings,
    districts,
    roads,
    connections,
    coreBuildingId: coreBuilding?.id ?? buildings[0]?.id ?? "",
    cycles: findCycles(analysis),
    insights,
    bounds: {
      width,
      depth,
      radius: Math.hypot(width, depth) / 2,
    },
    stats: {
      files: buildings.length,
      districts: districts.length,
      dependencies: analysis.edges.length,
      languages: new Set(analysis.files.map((file) => file.language)).size,
    },
  };
}
