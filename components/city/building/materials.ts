import { Color, MeshPhysicalMaterial, MeshStandardMaterial } from "three";

import type { BuildingTone, CityBuilding, CityLayer } from "@/types/city";

export const palettes: Record<BuildingTone, { body: string; trim: string; roof: string; glass: string; light: string }> = {
  stone: { body: "#a6a89f", trim: "#d7d0bf", roof: "#4d5754", glass: "#20363c", light: "#ffd98f" },
  brick: { body: "#986f5d", trim: "#cbb59d", roof: "#505957", glass: "#20343a", light: "#ffc978" },
  concrete: { body: "#798983", trim: "#bec7bd", roof: "#43524f", glass: "#17343d", light: "#cde2bf" },
  sand: { body: "#b29c78", trim: "#ded0ae", roof: "#555e57", glass: "#21383e", light: "#ffda8d" },
  slate: { body: "#65767c", trim: "#aebbb8", roof: "#3e4c50", glass: "#172d36", light: "#bddbd1" },
};

export function analyticalColor(building: CityBuilding, layer: CityLayer) {
  const metrics = building.metrics;
  if (layer === "complexity") return new Color("#dfcc8d").lerp(new Color("#c84f43"), Math.min(1, metrics.complexity / 45));
  if (layer === "activity") return new Color("#72857c").lerp(new Color("#e6bd5d"), Math.min(1, metrics.recentChanges / 4));
  if (layer === "dependencies") return new Color("#71817b").lerp(new Color("#57bbb3"), Math.min(1, (metrics.dependencies + metrics.dependents) / 12));
  if (layer === "risk") return new Color("#76907c").lerp(new Color("#d85849"), metrics.risk);
  if (layer === "ownership" && metrics.primaryAuthor) {
    let hue = 0;
    for (const character of metrics.primaryAuthor) hue = (hue * 31 + character.charCodeAt(0)) % 360;
    return new Color(`hsl(${hue}, 34%, 63%)`);
  }
  return new Color(palettes[building.tone].body);
}

export function createBuildingMaterials(building: CityBuilding, active: boolean, layer: CityLayer, override: string | null, night = false) {
  const palette = palettes[building.tone];
  const facadeColor = override ? new Color(override) : analyticalColor(building, layer);
  if (active) facadeColor.lerp(new Color("#ffffff"), 0.14);

  return {
    facade: new MeshStandardMaterial({
      color: facadeColor,
      roughness: building.variant === "laboratory" ? 0.58 : 0.76,
      metalness: building.variant === "industrial" ? 0.15 : 0.035,
      envMapIntensity: 0.72,
      emissive: override ? new Color(override) : new Color("#000000"),
      emissiveIntensity: override ? 0.08 : 0,
    }),
    roof: new MeshStandardMaterial({ color: palette.roof, roughness: 0.68, metalness: 0.22, envMapIntensity: 0.9 }),
    base: new MeshStandardMaterial({ color: palette.trim, roughness: 0.88, metalness: 0.02 }),
    accent: new MeshStandardMaterial({ color: palette.trim, roughness: 0.62, metalness: 0.12, envMapIntensity: 0.8 }),
    glass: new MeshPhysicalMaterial({
      color: palette.glass,
      roughness: 0.16,
      metalness: 0.18,
      clearcoat: 0.75,
      clearcoatRoughness: 0.2,
      envMapIntensity: 1.35,
      emissive: new Color(palette.light),
      emissiveIntensity: active ? 0.32 : night ? 0.16 : 0.055,
    }),
    windowLight: new MeshStandardMaterial({
      color: palette.light,
      roughness: 0.32,
      metalness: 0.08,
      emissive: new Color(palette.light),
      emissiveIntensity: active ? 1.8 : night ? 1.25 : 0.4,
      toneMapped: true,
    }),
  };
}

export type BuildingMaterials = ReturnType<typeof createBuildingMaterials>;
