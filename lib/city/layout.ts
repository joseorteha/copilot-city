import type { CityDistrict, Position2D } from "@/types/city";
import type { RepositoryAnalysis, RepositoryFile } from "@/types/repository";

export interface DistrictPlan extends CityDistrict {
  columns: number;
  rows: number;
  files: RepositoryFile[];
}

/**
 * Clearance between district edges. It has to stay wider than twice the corridor margin in
 * `roads.ts`, or inter-district avenues cannot fit in the gap and detour around the city.
 */
export const DISTRICT_GAP = 3.2;

/** Lot pitch, shared by the block geometry, the internal street grid and the district size. */
export const SPACING_X = 5.4;
export const SPACING_Z = 6.4;
/** Pavement left around the outermost lots, for the perimeter street and its trees. */
export const DISTRICT_PADDING = 3.8;

export function lotPositions(plan: DistrictPlan): Position2D[] {
  return Array.from({ length: plan.columns * plan.rows }, (_, index) => {
    const column = index % plan.columns;
    const row = Math.floor(index / plan.columns);
    const side = column < plan.columns / 2 ? -1 : 1;
    return [
      plan.position[0] + (column - (plan.columns - 1) / 2) * SPACING_X + side * 1.15,
      plan.position[1] + (row - (plan.rows - 1) / 2) * SPACING_Z,
    ];
  });
}

function overlaps(plan: DistrictPlan, position: Position2D, placed: DistrictPlan[]) {
  return placed.some(
    (other) =>
      Math.abs(position[0] - other.position[0]) < (plan.size[0] + other.size[0]) / 2 + DISTRICT_GAP &&
      Math.abs(position[1] - other.position[1]) < (plan.size[1] + other.size[1]) / 2 + DISTRICT_GAP,
  );
}

/**
 * Block packing: every district is offered the four sides of every district already placed,
 * staggered along the shared edge, and takes the cheapest slot. Districts that import from
 * each other pull together; the whole city is pulled towards its own centre.
 */
export function arrangeDistricts(
  plans: DistrictPlan[],
  analysis: RepositoryAnalysis,
  ranks: Map<string, number>,
) {
  const fileDistrict = new Map(analysis.files.map((file) => [file.id, file.district]));
  const coupling = new Map<string, number>();
  for (const edge of analysis.edges) {
    const a = fileDistrict.get(edge.source),
      b = fileDistrict.get(edge.target);
    if (!a || !b || a === b) continue;
    const key = [a, b].sort().join("|");
    coupling.set(key, (coupling.get(key) ?? 0) + 1);
  }

  const centrality = (plan: DistrictPlan) =>
    Math.max(0, ...plan.files.map((file) => ranks.get(file.id) ?? 0));
  const couplingBetween = (a: DistrictPlan, b: DistrictPlan) =>
    coupling.get([a.id, b.id].sort().join("|")) ?? 0;

  plans.sort((a, b) => centrality(b) - centrality(a) || a.id.localeCompare(b.id));

  const placed: DistrictPlan[] = [];
  for (const plan of plans) {
    if (!placed.length) {
      plan.position = [0, 0];
      placed.push(plan);
      continue;
    }

    const candidates: Position2D[] = [];
    for (const other of placed) {
      const spanX = (plan.size[0] + other.size[0]) / 2 + DISTRICT_GAP;
      const spanZ = (plan.size[1] + other.size[1]) / 2 + DISTRICT_GAP;
      for (const stagger of [0, -0.3, 0.3]) {
        candidates.push([other.position[0] - spanX, other.position[1] + other.size[1] * stagger]);
        candidates.push([other.position[0] + spanX, other.position[1] + other.size[1] * stagger]);
        candidates.push([other.position[0] + other.size[0] * stagger, other.position[1] - spanZ]);
        candidates.push([other.position[0] + other.size[0] * stagger, other.position[1] + spanZ]);
      }
    }

    let best: Position2D = [0, 0];
    let bestCost = Infinity;
    for (const candidate of candidates) {
      if (overlaps(plan, candidate, placed)) continue;
      let cost = Math.hypot(candidate[0], candidate[1]) * (1 + centrality(plan) * 1.5);
      for (const other of placed) {
        cost +=
          Math.hypot(candidate[0] - other.position[0], candidate[1] - other.position[1]) *
          couplingBetween(plan, other);
      }
      if (cost < bestCost) {
        bestCost = cost;
        best = candidate;
      }
    }

    // Every candidate collided: fall back to a ring sweep so a district is never dropped.
    if (!Number.isFinite(bestCost)) {
      for (let ring = 1; ring <= 60 && !Number.isFinite(bestCost); ring += 1) {
        for (let sample = 0; sample < 64; sample += 1) {
          const angle = (sample * Math.PI) / 32;
          const candidate: Position2D = [Math.cos(angle) * ring * 3, Math.sin(angle) * ring * 3];
          if (overlaps(plan, candidate, placed)) continue;
          best = candidate;
          bestCost = 0;
          break;
        }
      }
    }

    plan.position = best;
    placed.push(plan);
  }

  const minX = Math.min(0, ...plans.map((plan) => plan.position[0] - plan.size[0] / 2));
  const maxX = Math.max(0, ...plans.map((plan) => plan.position[0] + plan.size[0] / 2));
  const minZ = Math.min(0, ...plans.map((plan) => plan.position[1] - plan.size[1] / 2));
  const maxZ = Math.max(0, ...plans.map((plan) => plan.position[1] + plan.size[1] / 2));

  for (const plan of plans) {
    plan.position = [plan.position[0] - (minX + maxX) / 2, plan.position[1] - (minZ + maxZ) / 2];
    plan.plazaPosition = lotPositions(plan).sort(
      (a, b) =>
        Math.hypot(a[0] - plan.position[0], a[1] - plan.position[1]) -
        Math.hypot(b[0] - plan.position[0], b[1] - plan.position[1]),
    )[0];
  }
}
