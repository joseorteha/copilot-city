import { CanvasTexture, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, type Texture } from "three";

import type { BuildingProfile } from "./archetypes";

export type FacadePattern = BuildingProfile["facade"];

/** One tile covers this many floors and structural bays, so lit windows never repeat visibly. */
const TILE_FLOORS = 4;
const TILE_BAYS = 4;
const CELL = 128;

/**
 * Three maps per pattern, baked from the same description:
 *
 * - `albedo`   multiplies the analytical facade colour.
 * - `emissive` lights the windows at night.
 * - `surface`  packs roughness in green and metalness in blue, the channels three reads for
 *   `roughnessMap` and `metalnessMap`. This is the map that matters most: without it every
 *   pane had the same matte response as the concrete around it, so glass reflected nothing
 *   and the whole city read as painted cardboard.
 * - `height` darkens recessed panes and lifts frames/cornices for a restrained bump effect.
 */
export type FacadeMapKind = "albedo" | "emissive" | "surface" | "height";

interface PatternSpec {
  /** Window opening as a fraction of the bay and of the floor. */
  width: number;
  height: number;
  /** How far down the floor the opening starts. */
  top: number;
  /** Vertical mullions splitting one opening into lights. */
  lights: number;
  /** Horizontal transom near the head of the opening. */
  transom: boolean;
  /** Chance a given window reads as lit at night. */
  litRatio: number;
  /** Pilaster width as a fraction of the bay; 0 leaves a flat wall. */
  pilaster: number;
}

const PATTERNS: Record<FacadePattern, PatternSpec> = {
  grid: {
    width: 0.52,
    height: 0.46,
    top: 0.18,
    lights: 2,
    transom: true,
    litRatio: 0.42,
    pilaster: 0.07,
  },
  ribbon: {
    width: 0.88,
    height: 0.34,
    top: 0.24,
    lights: 4,
    transom: false,
    litRatio: 0.4,
    pilaster: 0,
  },
  vertical: {
    width: 0.38,
    height: 0.74,
    top: 0.11,
    lights: 1,
    transom: true,
    litRatio: 0.46,
    pilaster: 0.13,
  },
  open: {
    width: 0.8,
    height: 0.68,
    top: 0.14,
    lights: 3,
    transom: true,
    litRatio: 0.52,
    pilaster: 0.05,
  },
  technical: {
    width: 0.3,
    height: 0.14,
    top: 0.32,
    lights: 1,
    transom: false,
    litRatio: 0.18,
    pilaster: 0.1,
  },
};

/** Deterministic per-cell noise so every build renders the same city. */
function cellNoise(bay: number, floor: number, salt: number) {
  const value = Math.sin((bay + 1) * 37.13 + (floor + 1) * 91.7 + salt * 17.77) * 43758.5453;
  return value - Math.floor(value);
}

function paintTile(pattern: FacadePattern, kind: FacadeMapKind) {
  const spec = PATTERNS[pattern];
  const canvas = document.createElement("canvas");
  canvas.width = CELL * TILE_BAYS;
  canvas.height = CELL * TILE_FLOORS;
  const context = canvas.getContext("2d");
  if (!context) return canvas;

  // Wall defaults: near-white albedo so the analytical colour survives, matte dielectric
  // surface (green 0.92 / blue 0), black emissive.
  const wall =
    kind === "albedo"
      ? "#efece6"
      : kind === "surface"
        ? "#00eb00"
        : kind === "height"
          ? "#8d8d8d"
          : "#000000";
  context.fillStyle = wall;
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let floor = 0; floor < TILE_FLOORS; floor += 1) {
    const floorTop = floor * CELL;

    if (kind === "albedo") {
      // Floor slab: the horizontal rhythm that survives at map distance.
      context.fillStyle = "#ddd9d1";
      context.fillRect(0, floorTop + CELL - 10, canvas.width, 10);
      context.fillStyle = "#c6c2b9";
      context.fillRect(0, floorTop + CELL - 3, canvas.width, 3);
      context.fillStyle = "#f6f3ed";
      context.fillRect(0, floorTop + CELL - 12, canvas.width, 2);
    }
    if (kind === "height") {
      context.fillStyle = "#adadad";
      context.fillRect(0, floorTop + CELL - 10, canvas.width, 8);
    }

    for (let bay = 0; bay < TILE_BAYS; bay += 1) {
      const bayLeft = bay * CELL;

      if (spec.pilaster && kind === "albedo") {
        context.fillStyle = "#f7f4ee";
        context.fillRect(bayLeft, floorTop, CELL * spec.pilaster, CELL);
        context.fillStyle = "#d8d4cc";
        context.fillRect(bayLeft + CELL * spec.pilaster, floorTop, 2, CELL);
      }

      const openingWidth = CELL * spec.width;
      const openingHeight = CELL * spec.height;
      const x = bayLeft + (CELL - openingWidth) / 2;
      const y = floorTop + CELL * spec.top;
      const lit = cellNoise(bay, floor, 3) < spec.litRatio;

      if (kind === "emissive") {
        if (!lit) continue;
        // Interior light falls off towards the bottom of the pane instead of filling it
        // flat, and a few rooms burn cool against the warm ones.
        const cool = cellNoise(bay, floor, 21) > 0.86;
        const strength = 0.55 + cellNoise(bay, floor, 9) * 0.45;
        const gradient = context.createLinearGradient(x, y, x, y + openingHeight);
        const hot = cool ? `rgba(214, 236, 255, ${strength})` : `rgba(255, 214, 148, ${strength})`;
        const dim = cool
          ? `rgba(120, 158, 190, ${strength * 0.35})`
          : `rgba(186, 132, 62, ${strength * 0.35})`;
        gradient.addColorStop(0, hot);
        gradient.addColorStop(0.72, hot);
        gradient.addColorStop(1, dim);
        context.fillStyle = gradient;
        context.fillRect(x, y, openingWidth, openingHeight);
        continue;
      }

      if (kind === "height") {
        context.fillStyle = "#3c3c3c";
        context.fillRect(x, y, openingWidth, openingHeight);
        context.strokeStyle = "#c8c8c8";
        context.lineWidth = 5;
        context.strokeRect(x - 2.5, y - 2.5, openingWidth + 5, openingHeight + 5);
        context.fillStyle = "#e0e0e0";
        context.fillRect(x - 4, y + openingHeight + 3, openingWidth + 8, 5);
        continue;
      }

      if (kind === "surface") {
        // Glass: smooth and near-metallic, so it mirrors the sky and the city around it.
        context.fillStyle = "#001cd9";
        context.fillRect(x, y, openingWidth, openingHeight);
        // Frame: satin metal, the transition that stops the pane looking like a decal.
        context.strokeStyle = "#00664d";
        context.lineWidth = 5;
        context.strokeRect(x - 2.5, y - 2.5, openingWidth + 5, openingHeight + 5);
        continue;
      }

      // Reveal, then glass. A vertical gradient reads as sky reflected down the pane.
      context.fillStyle = "#8e938f";
      context.fillRect(x - 4, y - 4, openingWidth + 8, openingHeight + 8);
      const glass = context.createLinearGradient(x, y, x, y + openingHeight);
      glass.addColorStop(0, "#6f8593");
      glass.addColorStop(0.45, "#41525f");
      glass.addColorStop(1, "#28333d");
      context.fillStyle = glass;
      context.fillRect(x, y, openingWidth, openingHeight);

      context.fillStyle = "#aeb4b3";
      for (let light = 1; light < spec.lights; light += 1) {
        context.fillRect(x + (openingWidth * light) / spec.lights - 1.5, y, 3, openingHeight);
      }
      if (spec.transom) {
        context.fillStyle = "#a3aaa8";
        context.fillRect(x, y + openingHeight * 0.28, openingWidth, 3);
      }
      // Sill catches the sun and separates the opening from the wall below it.
      context.fillStyle = "#fbf8f1";
      context.fillRect(x - 4, y + openingHeight + 4, openingWidth + 8, 4);
    }
  }

  return canvas;
}

const cache = new Map<string, Texture | null>();

export function facadeTexture(pattern: FacadePattern, kind: FacadeMapKind) {
  if (typeof document === "undefined") return null;
  const key = `${pattern}:${kind}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const texture = new CanvasTexture(paintTile(pattern, kind));
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.anisotropy = 4;
  texture.minFilter = LinearMipmapLinearFilter;
  // Only the albedo is colour; roughness, metalness and emissive masks are raw data.
  if (kind === "albedo") texture.colorSpace = SRGBColorSpace;
  cache.set(key, texture);
  return texture;
}

/**
 * A facade instance needs its own repeat, but clones share the uploaded image and the
 * clones themselves are cached by shape, so the whole city still costs fifteen GPU textures.
 */
const repeatCache = new Map<string, Texture | null>();

export function facadeMap(pattern: FacadePattern, kind: FacadeMapKind, bays: number, floors: number) {
  const key = `${pattern}:${kind}:${bays}:${floors}`;
  const cached = repeatCache.get(key);
  if (cached !== undefined) return cached;

  const source = facadeTexture(pattern, kind);
  if (!source) return null;
  const texture = source.clone();
  // Side UVs wrap all four elevations, so a bay count is four times the per-face count.
  texture.repeat.set((bays * 4) / TILE_BAYS, floors / TILE_FLOORS);
  texture.needsUpdate = true;
  repeatCache.set(key, texture);
  return texture;
}
