import type { CityRoad, Position2D } from "@/types/city";
import type { RepositoryAnalysis } from "@/types/repository";
import { SPACING_Z, type DistrictPlan } from "./layout";
import { terrainHeight } from "./terrain";

const distance = (a: Position2D, b: Position2D) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const pointKey = (p: Position2D) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`;

function segmentHitsRect(a: Position2D, b: Position2D, rect: number[]) {
  const [minX, minZ, maxX, maxZ] = rect;
  let enter = 0,
    leave = 1;
  for (const [start, delta, min, max] of [
    [a[0], b[0] - a[0], minX, maxX],
    [a[1], b[1] - a[1], minZ, maxZ],
  ]) {
    if (Math.abs(delta) < 1e-8) {
      if (start <= min || start >= max) return false;
    } else {
      const t1 = (min - start) / delta,
        t2 = (max - start) / delta;
      enter = Math.max(enter, Math.min(t1, t2));
      leave = Math.min(leave, Math.max(t1, t2));
    }
  }
  return enter < leave && leave > 0.02 && enter < 0.98;
}

/** Picks one calm city corridor, preferring an orthogonal boulevard and avoiding blocks. */
function corridor(a: Position2D, b: Position2D, plans: DistrictPlan[]): Position2D[] {
  // Must stay below half of DISTRICT_GAP, otherwise no corridor fits between neighbours
  // and every avenue detours around the whole city.
  const margin = 1.1;
  const rects = plans.map((plan) => [
    plan.position[0] - plan.size[0] / 2 - margin,
    plan.position[1] - plan.size[1] / 2 - margin,
    plan.position[0] + plan.size[0] / 2 + margin,
    plan.position[1] + plan.size[1] / 2 + margin,
  ]);
  const minX = Math.min(...rects.map((r) => r[0])) - 3;
  const maxX = Math.max(...rects.map((r) => r[2])) + 3;
  const minZ = Math.min(...rects.map((r) => r[1])) - 3;
  const maxZ = Math.max(...rects.map((r) => r[3])) + 3;
  const candidates: Position2D[][] = [
    [a, b],
    [a, [a[0], b[1]], b],
    [a, [b[0], a[1]], b],
    [a, [a[0], minZ], [b[0], minZ], b],
    [a, [a[0], maxZ], [b[0], maxZ], b],
    [a, [minX, a[1]], [minX, b[1]], b],
    [a, [maxX, a[1]], [maxX, b[1]], b],
  ];
  return candidates
    .sort((left, right) => {
      const score = (route: Position2D[]) =>
        route.slice(1).reduce((sum, point, index) => {
          const from = route[index];
          return (
            sum +
            distance(from, point) +
            rects.filter((rect) => segmentHitsRect(from, point, rect)).length * 1000 +
            (route.length - 2) * 1.8
          );
        }, 0);
      return score(left) - score(right);
    })[0]
    .filter((point, index, list) => !index || distance(point, list[index - 1]) > 0.01);
}

export function createRoads(plans: DistrictPlan[], analysis: RepositoryAnalysis): CityRoad[] {
  const roads: CityRoad[] = [];
  const seenSegments = new Set<string>();
  const add = (
    id: string,
    from: Position2D,
    to: Position2D,
    width: number,
    strength: number,
    districts: [string, string],
    kind?: CityRoad["kind"],
  ) => {
    if (distance(from, to) < 0.01) return;
    const key = [pointKey(from), pointKey(to)].sort().join("|");
    if (seenSegments.has(key)) return;
    seenSegments.add(key);
    roads.push({
      id,
      from,
      to,
      width,
      strength,
      districts,
      kind: kind ?? (width >= 1.75 ? "avenue" : "street"),
    });
  };

  const portals = new Map<
    string,
    { north: Position2D; south: Position2D; west: Position2D; east: Position2D }
  >();
  for (const plan of plans) {
    const [x, z] = plan.position;
    const halfW = plan.size[0] / 2 - 0.7;
    const crossStreets = Array.from(
      { length: plan.rows + 1 },
      (_, row) => z + (row - plan.rows / 2) * SPACING_Z,
    );
    const middleStreet = crossStreets[Math.floor(crossStreets.length / 2)];
    const edgeX = plan.size[0] / 2 + 1.2;
    const edgeZ = plan.size[1] / 2 + 1.2;
    const districtPortals = {
      north: [x, z - edgeZ] as Position2D,
      south: [x, z + edgeZ] as Position2D,
      west: [x - edgeX, middleStreet] as Position2D,
      east: [x + edgeX, middleStreet] as Position2D,
    };
    portals.set(plan.id, districtPortals);
    for (let index = 1; index < crossStreets.length; index++) {
      add(
        `avenue:${plan.id}:${index}`,
        [x, crossStreets[index - 1]],
        [x, crossStreets[index]],
        2.05,
        plan.buildingCount,
        [plan.id, plan.id],
        "avenue",
      );
    }
    for (let index = 0; index < crossStreets.length; index++) {
      const row = crossStreets[index];
      add(
        `street:${plan.id}:${index}:west`,
        [x - halfW, row],
        [x, row],
        1.12,
        0,
        [plan.id, plan.id],
        "street",
      );
      add(
        `street:${plan.id}:${index}:east`,
        [x, row],
        [x + halfW, row],
        1.12,
        0,
        [plan.id, plan.id],
        "street",
      );
    }
    add(
      `portal:${plan.id}:north`,
      [x, crossStreets[0]],
      districtPortals.north,
      1.72,
      0,
      [plan.id, plan.id],
      "avenue",
    );
    add(
      `portal:${plan.id}:south`,
      [x, crossStreets.at(-1)!],
      districtPortals.south,
      1.72,
      0,
      [plan.id, plan.id],
      "avenue",
    );
    add(
      `portal:${plan.id}:west`,
      [x - halfW, middleStreet],
      districtPortals.west,
      1.5,
      0,
      [plan.id, plan.id],
      "street",
    );
    add(
      `portal:${plan.id}:east`,
      [x + halfW, middleStreet],
      districtPortals.east,
      1.5,
      0,
      [plan.id, plan.id],
      "street",
    );
  }

  const districtByFile = new Map(analysis.files.map((file) => [file.id, file.district]));
  const strengths = new Map<string, number>();
  for (const edge of analysis.edges) {
    const a = districtByFile.get(edge.source),
      b = districtByFile.get(edge.target);
    if (!a || !b || a === b) continue;
    const key = [a, b].sort().join("|");
    strengths.set(key, (strengths.get(key) ?? 0) + 1);
  }

  const selectedPairs = new Map<string, { a: DistrictPlan; b: DistrictPlan; strength: number }>();
  const connected = new Set<string>(plans[0] ? [plans[0].id] : []);
  while (connected.size < plans.length) {
    const choices = plans.flatMap((a) =>
      connected.has(a.id)
        ? plans
            .filter((b) => !connected.has(b.id))
            .map((b) => {
              const key = [a.id, b.id].sort().join("|");
              const strength = strengths.get(key) ?? 0;
              return { a, b, strength, score: strength * 18 - distance(a.position, b.position) };
            })
        : [],
    );
    const best = choices.sort((a, b) => b.score - a.score)[0];
    if (!best) break;
    const key = [best.a.id, best.b.id].sort().join("|");
    selectedPairs.set(key, best);
    connected.add(best.b.id);
  }
  [...strengths.entries()]
    .filter(([key]) => !selectedPairs.has(key))
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.ceil(plans.length / 3))
    .forEach(([key, strength]) => {
      const [aId, bId] = key.split("|");
      const a = plans.find((plan) => plan.id === aId),
        b = plans.find((plan) => plan.id === bId);
      if (a && b) selectedPairs.set(key, { a, b, strength });
    });

  // A corridor that leaves the urban plateau for a dip in the terrain becomes a bridge.
  const BRIDGE_DEPTH = -0.62;
  const spansHollow = (from: Position2D, to: Position2D) => {
    const midpoint: Position2D = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
    return terrainHeight(midpoint[0], midpoint[1], plans) < BRIDGE_DEPTH && distance(from, to) > 6;
  };

  for (const [key, { a, b, strength }] of selectedPairs) {
    const dx = b.position[0] - a.position[0],
      dz = b.position[1] - a.position[1];
    const horizontal = Math.abs(dx) > Math.abs(dz);
    const aPortal = horizontal
      ? dx > 0
        ? portals.get(a.id)!.east
        : portals.get(a.id)!.west
      : dz > 0
        ? portals.get(a.id)!.south
        : portals.get(a.id)!.north;
    const bPortal = horizontal
      ? dx > 0
        ? portals.get(b.id)!.west
        : portals.get(b.id)!.east
      : dz > 0
        ? portals.get(b.id)!.north
        : portals.get(b.id)!.south;
    const path = corridor(aPortal, bPortal, plans);
    for (let index = 1; index < path.length; index++) {
      const from = path[index - 1],
        to = path[index];
      const width = Math.min(2.45, 1.72 + Math.log2(strength + 1) * 0.16);
      add(
        `corridor:${key}:${index}`,
        from,
        to,
        width,
        strength,
        [a.id, b.id],
        spansHollow(from, to) ? "bridge" : "avenue",
      );
    }
  }
  return roads;
}

/** Road graph, with projections at driveways. Connections follow actual infrastructure. */
export function roadRouter(roads: CityRoad[]) {
  const key = pointKey;
  const nodes = new Map<string, Position2D>();
  const graph = new Map<string, { id: string; cost: number }[]>();
  for (const road of roads) {
    const a = key(road.from),
      b = key(road.to);
    nodes.set(a, road.from);
    nodes.set(b, road.to);
    graph.set(a, [...(graph.get(a) ?? []), { id: b, cost: distance(road.from, road.to) }]);
    graph.set(b, [...(graph.get(b) ?? []), { id: a, cost: distance(road.from, road.to) }]);
  }

  const attachCache = new Map<string, { point: Position2D; road: CityRoad; distance: number }>();
  const attach = (p: Position2D, district: string) => {
    const cacheKey = `${key(p)}|${district}`;
    const cached = attachCache.get(cacheKey);
    if (cached) return cached;
    let best = { point: p, road: roads[0], distance: Infinity };
    for (const road of roads) {
      if (road.districts[0] !== district || road.districts[1] !== district || road.kind !== "street")
        continue;
      const dx = road.to[0] - road.from[0],
        dz = road.to[1] - road.from[1];
      const t = Math.max(
        0,
        Math.min(1, ((p[0] - road.from[0]) * dx + (p[1] - road.from[1]) * dz) / (dx * dx + dz * dz)),
      );
      const point: Position2D = [road.from[0] + dx * t, road.from[1] + dz * t];
      if (distance(p, point) < best.distance) best = { point, road, distance: distance(p, point) };
    }
    attachCache.set(cacheKey, best);
    return best;
  };

  /**
   * Shortest paths from one driveway, memoised. Most files in a district attach to the same
   * few street segments, so a whole repository resolves in a handful of sweeps instead of
   * one per dependency edge.
   */
  const treeCache = new Map<string, { costs: Map<string, number>; previous: Map<string, string> }>();
  const shortestPaths = (from: CityRoad, point: Position2D) => {
    const cacheKey = `${from.id}|${key(point)}`;
    const cached = treeCache.get(cacheKey);
    if (cached) return cached;

    const costs = new Map<string, number>();
    const previous = new Map<string, string>();
    // Binary heap: the previous linear scan made every lookup O(V^2).
    const heap: Array<{ id: string; cost: number }> = [];
    const push = (entry: { id: string; cost: number }) => {
      heap.push(entry);
      let index = heap.length - 1;
      while (index > 0) {
        const parent = (index - 1) >> 1;
        if (heap[parent].cost <= heap[index].cost) break;
        [heap[parent], heap[index]] = [heap[index], heap[parent]];
        index = parent;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        let index = 0;
        for (;;) {
          const left = index * 2 + 1,
            right = left + 1;
          let smallest = index;
          if (left < heap.length && heap[left].cost < heap[smallest].cost) smallest = left;
          if (right < heap.length && heap[right].cost < heap[smallest].cost) smallest = right;
          if (smallest === index) break;
          [heap[smallest], heap[index]] = [heap[index], heap[smallest]];
          index = smallest;
        }
      }
      return top;
    };

    for (const p of [from.from, from.to]) {
      const id = key(p);
      costs.set(id, distance(point, p));
      push({ id, cost: costs.get(id)! });
    }
    while (heap.length) {
      const { id, cost } = pop();
      if (cost > (costs.get(id) ?? Infinity)) continue;
      for (const neighbour of graph.get(id) ?? []) {
        const next = cost + neighbour.cost;
        if (next >= (costs.get(neighbour.id) ?? Infinity)) continue;
        costs.set(neighbour.id, next);
        previous.set(neighbour.id, id);
        push({ id: neighbour.id, cost: next });
      }
    }

    const tree = { costs, previous };
    treeCache.set(cacheKey, tree);
    return tree;
  };

  return (a: Position2D, b: Position2D, aDistrict: string, bDistrict: string): Position2D[] => {
    if (!roads.length) return [a, b];
    const start = attach(a, aDistrict),
      end = attach(b, bDistrict);
    if (!start.road || !end.road) return [a, b];
    if (start.road.id === end.road.id) return [a, start.point, end.point, b];

    const { costs, previous } = shortestPaths(start.road, start.point);
    const targets = [end.road.from, end.road.to].sort(
      (p, q) =>
        (costs.get(key(p)) ?? Infinity) +
        distance(p, end.point) -
        (costs.get(key(q)) ?? Infinity) -
        distance(q, end.point),
    );
    let cursor = key(targets[0]);
    if (!costs.has(cursor)) return [a, start.point, end.point, b];

    const path: Position2D[] = [end.point, b];
    const guard = new Set<string>();
    while (cursor && !guard.has(cursor)) {
      guard.add(cursor);
      path.unshift(nodes.get(cursor)!);
      cursor = previous.get(cursor) ?? "";
    }
    return [a, start.point, ...path];
  };
}
