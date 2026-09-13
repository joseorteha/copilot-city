import { Color, Material, MeshStandardMaterial } from "three";

import { facadeMap } from "./facade-texture";
import { profileFor } from "./archetypes";
import type { SurfaceKind } from "./assemble";
import type { BuildingTone, CityBuilding, CityLayer } from "@/types/city";

export const palettes: Record<
  BuildingTone,
  { body: string; trim: string; roof: string; glass: string; light: string; green: string }
> = {
  // Five materials a real street actually mixes, kept far enough apart in hue and value
  // that a block reads as several buildings. The previous set was five shades of the same
  // grey-green, which is why the city looked like one extruded mass.
  stone: {
    body: "#d8d0be",
    trim: "#f0e9da",
    roof: "#8f9188",
    glass: "#315d70",
    light: "#ffd79a",
    green: "#6d8a6b",
  },
  brick: {
    body: "#9f5842",
    trim: "#d9c09e",
    roof: "#725c50",
    glass: "#33607a",
    light: "#ffcd85",
    green: "#61805f",
  },
  concrete: {
    body: "#aaaead",
    trim: "#d9d8cf",
    roof: "#7a8683",
    glass: "#2d6480",
    light: "#d8f0e2",
    green: "#5b8069",
  },
  sand: {
    body: "#caaa72",
    trim: "#ead8ae",
    roof: "#9f927a",
    glass: "#356176",
    light: "#ffe3a4",
    green: "#77875f",
  },
  slate: {
    body: "#5e7d90",
    trim: "#cbd8dc",
    roof: "#5f7581",
    glass: "#23506e",
    light: "#c9ebe2",
    green: "#547a6c",
  },
};

export function analyticalColor(building: CityBuilding, layer: CityLayer) {
  const metrics = building.metrics;
  if (layer === "core" && building.centrality < 0.25) return new Color("#a7aaa1");
  if (layer === "activity")
    return new Color("#72857c").lerp(new Color("#e6bd5d"), Math.min(1, metrics.recentChanges / 4));
  if (layer === "dependencies")
    return new Color("#71817b").lerp(
      new Color("#57bbb3"),
      Math.min(1, (metrics.dependencies + metrics.dependents) / 12),
    );
  if (layer === "risk") return new Color("#76907c").lerp(new Color("#d85849"), metrics.risk);
  if (layer === "ownership" && metrics.primaryAuthor) {
    let hue = 0;
    for (const character of metrics.primaryAuthor) hue = (hue * 31 + character.charCodeAt(0)) % 360;
    return new Color(`hsl(${hue}, 34%, 63%)`);
  }
  return new Color(palettes[building.tone].body);
}

/** Structural bays across one elevation: the rhythm the facade texture has to match. */
function bayCount(building: CityBuilding) {
  const span = (building.width + building.depth) / 2;
  return Math.max(2, Math.min(6, Math.round(span / 1.35)));
}

type SurfaceSet = Record<Exclude<SurfaceKind, "facade">, Material>;

/**
 * Surfaces that only depend on the tone and the time of day: at most ten sets for a whole
 * city, so they are built once and never disposed.
 */
const surfaceCache = new Map<string, SurfaceSet>();

function surfaceSet(tone: BuildingTone, night: boolean): SurfaceSet {
  const key = `${tone}|${night}`;
  const cached = surfaceCache.get(key);
  if (cached) return cached;

  const palette = palettes[tone];
  const set: SurfaceSet = {
    trim: new MeshStandardMaterial({
      color: palette.trim,
      roughness: 0.52,
      metalness: 0.34,
      envMapIntensity: 1.3,
    }),
    roof: new MeshStandardMaterial({
      color: palette.roof,
      roughness: 0.7,
      metalness: 0.2,
      envMapIntensity: 1,
    }),
    green: new MeshStandardMaterial({ color: palette.green, roughness: 0.98, metalness: 0 }),
    glass: new MeshStandardMaterial({
      color: palette.glass,
      roughness: 0.12,
      metalness: 0.58,
      envMapIntensity: 2.4,
      emissive: new Color(palette.light),
      emissiveIntensity: night ? 0.5 : 0,
    }),
    light: new MeshStandardMaterial({
      color: palette.light,
      roughness: 0.32,
      metalness: 0.08,
      emissive: new Color(palette.light),
      emissiveIntensity: night ? 3.2 : 0.4,
    }),
    // Shopfront glazing: warm, glossy, and strongly emissive at night so the street level
    // reads as lit interiors. By day it is just bright tinted glass.
    retail: new MeshStandardMaterial({
      color: new Color("#ffe6b8"),
      roughness: 0.14,
      metalness: 0.3,
      envMapIntensity: 1.8,
      emissive: new Color("#ffd08a"),
      emissiveIntensity: night ? 2.4 : 0.15,
    }),
  };
  surfaceCache.set(key, set);
  return set;
}

/**
 * Facade materials vary with the analytical colour, so they are cached by the values that
 * actually change them rather than rebuilt per building on every layer switch. The cap is
 * generous enough for a large repository in both palettes and evicts oldest-first.
 */
const FACADE_CACHE_LIMIT = 600;
const facadeCache = new Map<string, MeshStandardMaterial>();

function facadeMaterial(building: CityBuilding, colorHex: string, override: string | null, night: boolean) {
  const profile = profileFor(building);
  const bays = bayCount(building);
  const key = `${colorHex}|${profile.facade}|${bays}|${building.floors}|${building.variant}|${override ?? ""}|${night}`;
  const cached = facadeCache.get(key);
  if (cached) return cached;

  const surface = facadeMap(profile.facade, "surface", bays, building.floors);
  const material = new MeshStandardMaterial({
    color: new Color(colorHex),
    map: facadeMap(profile.facade, "albedo", bays, building.floors),
    bumpMap: facadeMap(profile.facade, "height", bays, building.floors),
    bumpScale: 0.14,
    // Roughness and metalness come from the packed map, so the material keeps both factors
    // at 1 and lets the texture decide: matte concrete on the wall, near-mirror on the glass.
    roughnessMap: surface,
    metalnessMap: surface,
    roughness: 1,
    metalness: 1,
    envMapIntensity: 1.9,
    emissive: override ? new Color(override) : new Color("#ffffff"),
    emissiveMap: override ? null : facadeMap(profile.facade, "emissive", bays, building.floors),
    // Over 1 so the lit panes clear the bloom threshold and actually glow.
    emissiveIntensity: override ? 0.08 : night ? 2.6 : 0,
  });
  if (facadeCache.size >= FACADE_CACHE_LIMIT) {
    const oldest = facadeCache.keys().next().value;
    if (oldest) {
      // Maps are shared across materials by `facadeMap`, so only the material is released.
      facadeCache.get(oldest)?.dispose();
      facadeCache.delete(oldest);
    }
  }
  facadeCache.set(key, material);
  return material;
}

export interface BuildingMaterials extends SurfaceSet {
  facade: MeshStandardMaterial;
  overview: MeshStandardMaterial;
}

const overviewCache = new Map<string, MeshStandardMaterial>();

function overviewMaterial(building: CityBuilding, colorHex: string, night: boolean) {
  const profile = profileFor(building),
    bays = bayCount(building);
  const key = `${colorHex}|${profile.facade}|${bays}|${building.floors}|${night}`;
  const cached = overviewCache.get(key);
  if (cached) return cached;
  const material = new MeshStandardMaterial({
    color: new Color(colorHex),
    map: facadeMap(profile.facade, "albedo", bays, building.floors),
    roughness: 0.74,
    metalness: 0.08,
    envMapIntensity: 0.75,
    emissive: night ? new Color(palettes[building.tone].light) : new Color("#000000"),
    emissiveMap: night ? facadeMap(profile.facade, "emissive", bays, building.floors) : null,
    emissiveIntensity: night ? 0.85 : 0,
  });
  if (overviewCache.size >= FACADE_CACHE_LIMIT) {
    const oldest = overviewCache.keys().next().value;
    if (oldest) {
      overviewCache.get(oldest)?.dispose();
      overviewCache.delete(oldest);
    }
  }
  overviewCache.set(key, material);
  return material;
}

export function buildingMaterials(
  building: CityBuilding,
  active: boolean,
  layer: CityLayer,
  override: string | null,
  night = false,
): BuildingMaterials {
  const color = override ? new Color(override) : analyticalColor(building, layer);
  if (active) color.lerp(new Color("#ffffff"), 0.14);
  // Curtain-wall glass carries its own tint in the albedo, so on the plain structure view
  // it must not be multiplied by the archetype's masonry colour (which turned glass red or
  // brown). Analytical layers still recolour it so risk/activity/ownership keep working.
  const facadeColor =
    profileFor(building).facade === "curtain" && layer === "structure" && !override
      ? new Color(active ? "#f2f6f8" : "#ffffff")
      : color;
  return {
    ...surfaceSet(building.tone, night),
    facade: facadeMaterial(building, `#${facadeColor.getHexString()}`, override, night),
    overview: overviewMaterial(building, `#${color.getHexString()}`, night),
  };
}

/** Material list in the group order the assembler produced, ready for a multi-material mesh. */
export function materialsFor(kinds: readonly SurfaceKind[], materials: BuildingMaterials) {
  return kinds.map((kind) => materials[kind]);
}
