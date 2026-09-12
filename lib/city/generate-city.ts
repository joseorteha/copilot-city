import type {
  BuildingTone,
  BuildingVariant,
  CityBuilding,
  CityConnection,
  CityDistrict,
  CityModel,
  CityRoad,
  DistrictPurpose,
  Position2D,
} from "@/types/city";
import type { RepositoryAnalysis, RepositoryFile, RepositoryInsights } from "@/types/repository";

const DISTRICT_GAP = 7;
const DISTRICTS_PER_ROW = 3;
const CELL_WIDTH = 3.7;
const CELL_DEPTH = 3.9;
const DISTRICT_MARGIN = 4.2;
const PURPOSE_STYLE: Record<DistrictPurpose, { color: string; tones: BuildingTone[] }> = {
  frontend: { color: "#7f9699", tones: ["slate", "concrete"] },
  services: { color: "#829487", tones: ["concrete", "stone"] },
  data: { color: "#a18e6d", tones: ["sand", "brick"] },
  tests: { color: "#8c8498", tones: ["slate", "stone"] },
  docs: { color: "#a79b7e", tones: ["sand", "stone"] },
  infrastructure: { color: "#918477", tones: ["brick", "concrete"] },
  general: { color: "#89928a", tones: ["stone", "slate", "concrete"] },
};

interface DistrictPlan extends CityDistrict {
  columns: number;
  rows: number;
  files: RepositoryFile[];
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function titleCase(value: string) {
  if (value === "root") return "Raíz";
  if (value === "other") return "Otros";

  return value
    .replace(/[-_.]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
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

function chunks<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
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
      const columns = Math.max(2, Math.min(6, Math.ceil(Math.sqrt((files.length + 1) * 1.08))));
      const rows = Math.ceil((files.length + 1) / columns);

      return {
        id: district,
        name: titleCase(district),
        position: [0, 0],
        size: [columns * CELL_WIDTH + DISTRICT_MARGIN, rows * CELL_DEPTH + DISTRICT_MARGIN],
        color: PURPOSE_STYLE[purpose].color,
        buildingCount: files.length,
        purpose,
        plazaPosition: [0, 0],
        columns,
        rows,
        files,
      };
    });

  const planRows = chunks(plans, DISTRICTS_PER_ROW);
  const rowDepths = planRows.map((row) => Math.max(...row.map((plan) => plan.size[1])));
  const totalDepth = rowDepths.reduce((sum, depth) => sum + depth, 0) + Math.max(0, planRows.length - 1) * DISTRICT_GAP;
  let zCursor = -totalDepth / 2;

  planRows.forEach((row, rowIndex) => {
    const rowWidth = row.reduce((sum, plan) => sum + plan.size[0], 0) + Math.max(0, row.length - 1) * DISTRICT_GAP;
    const rowDepth = rowDepths[rowIndex];
    let xCursor = -rowWidth / 2;

    for (const plan of row) {
      plan.position = [xCursor + plan.size[0] / 2, zCursor + rowDepth / 2];
      plan.plazaPosition = plan.position;
      xCursor += plan.size[0] + DISTRICT_GAP;
    }

    zCursor += rowDepth + DISTRICT_GAP;
  });

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

function buildingVariant(file: RepositoryFile, importance: number, isLandmark: boolean): BuildingVariant {
  const path = file.path.toLowerCase();
  const district = file.district.toLowerCase();

  if (isLandmark) return "landmark";
  if (/(^|\/)(test|tests|__tests__|spec|specs)(\/|$)/.test(path) || /\.(test|spec)\./.test(path)) return "laboratory";
  if (file.extension === "md" || district.includes("doc")) return "library";
  if (/database|schema|migration|storage|cache|\.sql$/.test(path)) return "industrial";
  if (/(^|\/)(api|server|services?|routes?|controllers?)(\/|$)/.test(path)) return "tower";
  if (/docker|workflow|\.github|scripts?|config|webpack|vite|eslint|deploy/.test(path)) return "industrial";
  if (/auth|security|permission|session/.test(path)) return "corner";
  if (importance > 0.64) return "tower";

  const variants: BuildingVariant[] = ["office", "terrace", "corner"];
  return variants[hashString(file.path) % variants.length];
}

function createBuildings(plans: DistrictPlan[], analysis: RepositoryAnalysis, insights: RepositoryInsights) {
  const scores = importanceScores(analysis.files);
  const landmarkIds = new Set(
    [...analysis.files]
      .sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0))
      .slice(0, Math.max(1, Math.min(4, Math.ceil(analysis.files.length * 0.025))))
      .map((file) => file.id),
  );
  const buildings: CityBuilding[] = [];

  plans.forEach((plan) => {
    const sortedFiles = [...plan.files].sort((a, b) => {
      const scoreDifference = (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0);
      return scoreDifference || a.path.localeCompare(b.path);
    });
    const usableWidth = plan.size[0] - DISTRICT_MARGIN;
    const usableDepth = plan.size[1] - DISTRICT_MARGIN;
    const cellWidth = usableWidth / plan.columns;
    const cellDepth = usableDepth / plan.rows;

    const centerSlot = Math.floor(plan.rows / 2) * plan.columns + Math.floor(plan.columns / 2);

    sortedFiles.forEach((file, index) => {
      const slot = index >= centerSlot ? index + 1 : index;
      const column = slot % plan.columns;
      const row = Math.floor(slot / plan.columns);
      const hash = hashString(file.path);
      const importance = scores.get(file.id) ?? 0;
      const isLandmark = landmarkIds.has(file.id);
      const width = 1.72 + ((hash & 255) / 255) * 0.72;
      const depth = 1.78 + (((hash >>> 8) & 255) / 255) * 0.74;
      const floors = isLandmark
        ? 9 + Math.round(importance * 4)
        : Math.max(2, Math.min(10, 2 + Math.round(importance * 7)));
      const x = plan.position[0] - usableWidth / 2 + cellWidth * (column + 0.5);
      const z = plan.position[1] - usableDepth / 2 + cellDepth * (row + 0.5);
      const fileChanges = insights.commits.flatMap((commit) => commit.files.map((change) => ({ commit, change }))).filter(({ change }) => change.path === file.path);
      const additions = fileChanges.reduce((sum, item) => sum + item.change.additions, 0);
      const deletions = fileChanges.reduce((sum, item) => sum + item.change.deletions, 0);
      const authorCounts = new Map<string, number>();
      for (const item of fileChanges) authorCounts.set(item.commit.author, (authorCounts.get(item.commit.author) ?? 0) + 1);
      const primaryAuthor = [...authorCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const recentChanges = fileChanges.length;
      const changePressure = Math.min(1, recentChanges / Math.max(1, insights.commits.length * .5));
      const risk = Math.min(1, importance * .44 + (file.complexity / 100) * .28 + changePressure * .28);
      const dates = fileChanges.map((item) => item.commit.date).sort();

      buildings.push({
        id: `building:${file.id}`,
        nodeId: file.id,
        name: file.name,
        path: file.path,
        districtId: plan.id,
        position: [x, 0.34, z],
        rotation: hash % 2 === 0 ? 0 : Math.PI / 2,
        width: Math.min(width, cellWidth * 0.68),
        depth: Math.min(depth, cellDepth * 0.68),
        height: floors * 1.02,
        floors,
        variant: buildingVariant(file, importance, isLandmark),
        tone: PURPOSE_STYLE[plan.purpose].tones[hash % PURPOSE_STYLE[plan.purpose].tones.length],
        importance,
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

function districtBoundaryPoint(from: CityDistrict, to: CityDistrict): Position2D {
  const deltaX = to.position[0] - from.position[0];
  const deltaZ = to.position[1] - from.position[1];
  const length = Math.hypot(deltaX, deltaZ) || 1;
  const directionX = deltaX / length;
  const directionZ = deltaZ / length;
  const xDistance = Math.abs(directionX) < 0.0001 ? Number.POSITIVE_INFINITY : from.size[0] / 2 / Math.abs(directionX);
  const zDistance = Math.abs(directionZ) < 0.0001 ? Number.POSITIVE_INFINITY : from.size[1] / 2 / Math.abs(directionZ);
  const distance = Math.min(xDistance, zDistance) + 0.25;

  return [
    from.position[0] + directionX * distance,
    from.position[1] + directionZ * distance,
  ];
}

function createRoads(plans: DistrictPlan[], analysis: RepositoryAnalysis) {
  const districtByFile = new Map(analysis.files.map((file) => [file.id, file.district]));
  const coupling = new Map<string, { districts: [string, string]; strength: number }>();

  for (const edge of analysis.edges) {
    const sourceDistrict = districtByFile.get(edge.source);
    const targetDistrict = districtByFile.get(edge.target);
    if (!sourceDistrict || !targetDistrict || sourceDistrict === targetDistrict) continue;

    const districts: [string, string] = sourceDistrict < targetDistrict
      ? [sourceDistrict, targetDistrict]
      : [targetDistrict, sourceDistrict];
    const key = districts.join("→");
    const current = coupling.get(key) ?? { districts, strength: 0 };
    current.strength += 1;
    coupling.set(key, current);
  }

  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const connectedPairs = new Set<string>();
  const roads: CityRoad[] = plans.flatMap((plan) => {
    const halfWidth = plan.size[0] / 2 - 0.35;
    const halfDepth = plan.size[1] / 2 - 0.35;
    return [
      {
        id: `internal:${plan.id}:east-west`,
        from: [plan.position[0] - halfWidth, plan.position[1]],
        to: [plan.position[0] + halfWidth, plan.position[1]],
        width: 0.62,
        strength: 0,
        kind: "street",
        districts: [plan.id, plan.id],
      },
      {
        id: `internal:${plan.id}:north-south`,
        from: [plan.position[0], plan.position[1] - halfDepth],
        to: [plan.position[0], plan.position[1] + halfDepth],
        width: 0.62,
        strength: 0,
        kind: "street",
        districts: [plan.id, plan.id],
      },
    ] satisfies CityRoad[];
  });

  roads.push(...[...coupling.values()]
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 16)
    .flatMap((connection) => {
      const from = planById.get(connection.districts[0]);
      const to = planById.get(connection.districts[1]);
      if (!from || !to) return [];

      connectedPairs.add(connection.districts.join("→"));
      return [{
        id: `dependency:${connection.districts.join(":")}`,
        from: districtBoundaryPoint(from, to),
        to: districtBoundaryPoint(to, from),
        width: Math.min(2.5, 0.9 + Math.log2(connection.strength + 1) * 0.42),
        strength: connection.strength,
        kind: connection.strength >= 5 ? "avenue" : "bridge",
        districts: connection.districts,
      } satisfies CityRoad];
    }));

  for (let index = 1; index < plans.length; index += 1) {
    const current = plans[index];
    const nearest = plans
      .slice(0, index)
      .map((candidate) => ({
        candidate,
        distance: Math.hypot(
          candidate.position[0] - current.position[0],
          candidate.position[1] - current.position[1],
        ),
      }))
      .sort((a, b) => a.distance - b.distance)[0]?.candidate;

    if (!nearest) continue;
    const pair: [string, string] = nearest.id < current.id ? [nearest.id, current.id] : [current.id, nearest.id];
    if (connectedPairs.has(pair.join("→"))) continue;

    roads.push({
      id: `structure:${pair.join(":")}`,
      from: districtBoundaryPoint(nearest, current),
      to: districtBoundaryPoint(current, nearest),
      width: 0.85,
      strength: 0,
      kind: "street",
      districts: pair,
    });
  }

  return roads;
}

function createConnections(buildings: CityBuilding[], analysis: RepositoryAnalysis): CityConnection[] {
  const buildingByNode = new Map(buildings.map((building) => [building.nodeId, building]));
  return analysis.edges.flatMap((edge, index) => {
    const source = buildingByNode.get(edge.source);
    const target = buildingByNode.get(edge.target);
    if (!source || !target) return [];
    return [{
      id: `connection:${index}:${edge.source}:${edge.target}`,
      sourceBuildingId: source.id,
      targetBuildingId: target.id,
      source: [source.position[0], source.position[2]],
      target: [target.position[0], target.position[2]],
      specifier: edge.specifier,
      type: edge.type,
      crossDistrict: source.districtId !== target.districtId,
    } satisfies CityConnection];
  });
}

function findCycles(analysis: RepositoryAnalysis) {
  const adjacency = new Map<string, string[]>();
  for (const edge of analysis.edges) adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target]);
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

export function generateCity(analysis: RepositoryAnalysis, insights: RepositoryInsights = { commits: [], pullRequests: [], contributors: [], ci: null }): CityModel {
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
  const connections = createConnections(buildings, analysis);
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
