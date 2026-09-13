import type { RepositoryAnalysis } from "@/types/repository";

/** Deterministic PageRank: incoming dependencies contribute architectural centrality. */
export function graphCentrality(analysis: RepositoryAnalysis) {
  const ids = analysis.files.map((file) => file.id).sort();
  const links = new Map(ids.map((id) => [id, [] as string[]]));
  for (const edge of analysis.edges)
    if (links.has(edge.source) && links.has(edge.target)) links.get(edge.source)!.push(edge.target);
  let ranks = new Map(ids.map((id) => [id, 1 / Math.max(1, ids.length)]));
  for (let step = 0; step < 30; step++) {
    const dangling = ids.reduce((sum, id) => sum + (links.get(id)!.length ? 0 : ranks.get(id)!), 0);
    const next = new Map(ids.map((id) => [id, (0.15 + 0.85 * dangling) / Math.max(1, ids.length)]));
    for (const id of ids)
      for (const target of links.get(id)!)
        next.set(target, next.get(target)! + (0.85 * ranks.get(id)!) / links.get(id)!.length);
    ranks = next;
  }
  const maximum = Math.max(1e-9, ...ranks.values());
  return new Map(ids.map((id) => [id, ranks.get(id)! / maximum]));
}

export function hashString(value: string) {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return hash >>> 0;
}
