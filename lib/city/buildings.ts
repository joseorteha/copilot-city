import type { BuildingVariant } from "@/types/city";
import type { RepositoryFile } from "@/types/repository";
import { hashString } from "./graph";

export function classifyBuilding(
  file: RepositoryFile,
  centrality: number,
  landmark: boolean,
): BuildingVariant {
  const path = file.path.toLowerCase();
  if (landmark) return "landmark";
  if (/test|spec/.test(path)) return "laboratory";
  if (/\.md$|docs\//.test(path)) return "library";
  if (/database|schema|storage|cache|migration/.test(path)) return "data-center";
  if (/auth|security|permission|session/.test(path)) return "security";
  if (/service|api|route|controller/.test(path)) return "service-hub";
  if (/worker|queue|pipeline|build|docker/.test(path)) return "industrial";
  if (centrality > 0.45) return "tower";
  return (["office", "terrace", "corner"] as const)[hashString(path) % 3];
}

export const ARCHETYPE_LABELS: Record<BuildingVariant, string> = {
  office: "Oficinas",
  tower: "Torre",
  terrace: "Terrazas",
  corner: "Patio urbano",
  landmark: "Núcleo arquitectónico",
  industrial: "Planta de procesos",
  laboratory: "Laboratorio",
  library: "Biblioteca",
  "data-center": "Centro de datos",
  "service-hub": "Centro de servicios",
  security: "Centro de seguridad",
};
