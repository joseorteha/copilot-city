import { BufferGeometry, Euler, Matrix4, Quaternion, Vector3 } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import { profileFor } from "./archetypes";
import {
  UNIT_BOX,
  UNIT_CYLINDER_8,
  UNIT_CYLINDER_16,
  UNIT_ROUNDED_BOX,
  chamferedUnit,
  taperedUnit,
} from "./geometry";
import type { CityBuilding } from "@/types/city";

export const PODIUM_HEIGHT = 0.26;

/**
 * Every surface a building can present. One merged draw per kind replaces the dozen-odd
 * separate meshes the shell used to render, which is where the draw-call budget went.
 */
export const SURFACE_KINDS = ["facade", "trim", "roof", "glass", "light", "green", "retail"] as const;
export type SurfaceKind = (typeof SURFACE_KINDS)[number];

/** Detail tier a part belongs to: `far` parts survive every LOD step, `near` ones do not. */
type Tier = "far" | "near";

interface Part {
  kind: SurfaceKind;
  tier: Tier;
  geometry: BufferGeometry;
  matrix: Matrix4;
}

export interface AssembledBuilding {
  geometry: BufferGeometry;
  /** Material slots in group order; index i of this array is materialIndex i. */
  kinds: SurfaceKind[];
}

const scratchPosition = new Vector3();
const scratchQuaternion = new Quaternion();
const scratchScale = new Vector3();
const scratchEuler = new Euler();

function transform(
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number,
  rotationX = 0,
  rotationY = 0,
  rotationZ = 0,
) {
  scratchPosition.set(x, y, z);
  scratchQuaternion.setFromEuler(scratchEuler.set(rotationX, rotationY, rotationZ));
  scratchScale.set(width, height, depth);
  return new Matrix4().compose(scratchPosition, scratchQuaternion, scratchScale);
}

/**
 * Lays out one building as a flat list of transformed primitives. Kept separate from the
 * merge so the same description can produce several levels of detail.
 */
function describe(building: CityBuilding, w: number, d: number, h: number): Part[] {
  const profile = profileFor(building);
  const parts: Part[] = [];
  const variation = building.detailSeed % 4;
  // Stacked volumes already narrow as they rise, so they take only a fraction of the
  // archetype's taper — applying it in full turns every tower into a pine cone.
  const softened = (strength: number) => taperedUnit(1 - (1 - profile.taper) * strength);
  const massGeometry =
    profile.footprint === "slab" && variation === 0
      ? chamferedUnit(0.095)
      : profile.footprint === "pavilion" || building.variant === "laboratory"
        ? UNIT_ROUNDED_BOX
        : softened(1);

  const put = (
    kind: SurfaceKind,
    tier: Tier,
    geometry: BufferGeometry,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
  ) => parts.push({ kind, tier, geometry, matrix: transform(x, y + PODIUM_HEIGHT, z, width, height, depth) });

  const mass = (
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    geometry = massGeometry,
    kind: SurfaceKind = "facade",
  ) => put(kind, "far", geometry, x, y, z, width, height, depth);
  const box = (
    kind: SurfaceKind,
    tier: Tier,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
  ) => put(kind, tier, UNIT_BOX, x, y, z, width, height, depth);
  const rotatedBox = (
    kind: SurfaceKind,
    tier: Tier,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    rotationX = 0,
    rotationY = 0,
    rotationZ = 0,
  ) =>
    parts.push({
      kind,
      tier,
      geometry: UNIT_BOX,
      matrix: transform(x, y + PODIUM_HEIGHT, z, width, height, depth, rotationX, rotationY, rotationZ),
    });

  // Podium. Sits below the podium offset, so it is placed by hand.
  parts.push({
    kind: "trim",
    tier: "far",
    geometry: UNIT_BOX,
    matrix: transform(0, 0.13, 0, w * 1.12, 0.26, d * 1.12),
  });

  if (profile.footprint === "twin") {
    mass(-w * 0.23, h * 0.43, -0.08, w * 0.42, h * 0.86, d * 0.72, softened(0.55));
    mass(w * 0.23, h * 0.5, 0.08, w * 0.42, h, d * 0.72, softened(0.55));
    box("glass", "near", 0, h * 0.62, 0, w * 0.32, 0.28, d * 0.5);
  }

  if (profile.footprint === "courtyard") {
    mass(0, h * 0.48, -d * 0.31, w, h * 0.96, d * 0.34);
    mass(-w * 0.36, h * 0.36, d * 0.08, w * 0.28, h * 0.72, d * 0.64);
    mass(w * 0.36, h * 0.36, d * 0.08, w * 0.28, h * 0.72, d * 0.64);
    box("green", "far", 0, 0.045, d * 0.1, w * 0.38, 0.09, d * 0.48);
    box("trim", "near", 0, 1.05, d * 0.45, w * 0.46, 0.1, 0.52);
  }

  if (profile.footprint === "pavilion") {
    mass(0, h * 0.48, 0, w, h * 0.96, d, massGeometry, "trim");
    box("glass", "far", 0, h * 0.45, d * 0.02, w * 0.87, h * 0.76, d * 1.015);
    for (const offset of [-0.34, 0, 0.34])
      box("trim", "near", w * offset, h * 0.47, d * 0.53, 0.08, h * 0.82, 0.12);
    box("roof", "far", 0, h + 0.18, 0, w * 1.14, 0.18, d * 1.12);
  }

  if (profile.footprint === "terraced") {
    const tier = softened(0.3);
    for (const level of [0, 1, 2]) {
      const ratio = 1 - level * (building.variant === "terrace" ? 0.18 : 0.15);
      const tierHeight = h * (level === 0 ? 0.46 : 0.27);
      const base = level === 0 ? 0 : h * (0.46 + (level - 1) * 0.27);
      const offset = building.variant === "terrace" ? -w * level * 0.055 : 0;
      mass(offset, base + tierHeight / 2, 0, w * ratio, tierHeight, d * ratio, tier);
      if (level > 0)
        box("green", "far", offset + w * 0.2, base + 0.055, 0, w * ratio * 0.42, 0.11, d * ratio * 0.82);
    }
  }

  if (profile.footprint === "slab") {
    mass(0, h / 2, 0, w, h, d);
    if (building.variant === "industrial" || building.variant === "data-center") {
      for (let index = 0; index < 4; index += 1)
        box("trim", "near", -w * 0.36 + index * w * 0.24, h * 0.52, d * 0.515, 0.1, h * 0.68, 0.12);
    }
  }

  // Low lateral volumes that break the prism silhouette without crowding the next lot.
  if (profile.wings && (profile.footprint === "slab" || profile.footprint === "terraced")) {
    const wingHeight = h * (profile.footprint === "slab" ? 0.42 : 0.3);
    for (const side of [-1, 1])
      box("facade", "far", side * w * 0.46, wingHeight / 2, -d * 0.06, w * 0.2, wingHeight, d * 0.62);
  }

  // Contemporary Mexican street fronts: shaded balconies, deep frames and planters.
  // The pieces are merged into the near LOD, so this reads as architecture up close
  // without turning every balcony into a separate draw call.
  const residentialScale =
    building.variant === "terrace" || building.variant === "office" || building.variant === "corner";
  if (residentialScale && h > 4.2) {
    const balconyCount = Math.min(4, Math.max(2, Math.floor(h / 3.2)));
    for (let level = 0; level < balconyCount; level += 1) {
      const y = 1.85 + level * Math.max(1.35, (h - 2.2) / balconyCount);
      const side = (level + variation) % 2 === 0 ? -1 : 1;
      const balconyWidth = w * (variation === 3 ? 0.62 : 0.42);
      const x = side * w * (variation === 3 ? 0.04 : 0.22);
      box("trim", "near", x, y, d / 2 + 0.22, balconyWidth, 0.09, 0.46);
      box("glass", "near", x, y + 0.27, d / 2 + 0.42, balconyWidth * 0.94, 0.43, 0.035);
      if ((level + variation) % 3 === 0)
        box("green", "near", x, y + 0.16, d / 2 + 0.43, balconyWidth * 0.62, 0.16, 0.12);
    }
  }

  // Vertical brise-soleil turn the broad sunny elevations into shaded depth instead of
  // another painted rectangle. They are characteristic without becoming decorative noise.
  if ((building.tone === "sand" || building.tone === "brick") && profile.footprint !== "pavilion") {
    const fins = Math.min(5, Math.max(3, Math.round(w / 1.25)));
    for (let index = 0; index < fins; index += 1) {
      const x = -w * 0.38 + (index / Math.max(1, fins - 1)) * w * 0.76;
      box("trim", "near", x, h * 0.58, d / 2 + 0.15, 0.055, h * 0.54, 0.3);
    }
  }

  // Street-level retail: a glazed band wrapping the base, warm and bright after dark. This
  // is what turns a stack of dark slabs into a street with life at the bottom.
  if (profile.footprint === "slab" || profile.footprint === "twin" || profile.footprint === "terraced") {
    const bandHeight = Math.min(1.15, h * 0.16);
    box("retail", "far", 0, bandHeight / 2, 0, w * 1.015, bandHeight, d * 1.015);
    // A slim canopy over the shopfront, catching the glow.
    box("trim", "near", 0, bandHeight + 0.04, d / 2 + 0.16, w * 0.9, 0.06, 0.34);
    for (const side of [-1, 1])
      box("trim", "near", side * (w / 2 + 0.16), bandHeight + 0.04, 0, 0.34, 0.06, d * 0.9);
  }

  if (profile.footprint !== "pavilion") {
    box("glass", "near", 0, 0.55, d / 2 + 0.035, Math.min(w * 0.34, 1.05), 1.02, 0.08);
    box("trim", "near", 0, 1.14, d / 2 + 0.31, w * 0.43, 0.09, 0.68);
    if (profile.fins)
      for (const side of [-1, 1]) box("trim", "near", side * w * 0.43, h * 0.5, d * 0.51, 0.1, h * 0.9, 0.14);

    // The roof lands on the tapered top of the mass below it, not on its base footprint.
    const roofWidth =
      profile.footprint === "twin"
        ? w * 0.38
        : profile.footprint === "terraced"
          ? w * 0.58
          : w * profile.taper;
    const roofDepth =
      profile.footprint === "twin"
        ? d * 0.72
        : profile.footprint === "terraced"
          ? d * 0.62
          : d * profile.taper;

    // A cornice: a thin overhang at the top of the mass. It costs one box and it is what
    // stops a tower from ending as a bare cut, which was most of the "flat box" feeling.
    box("trim", "far", 0, h - 0.06, 0, roofWidth * 1.06, 0.12, roofDepth * 1.06);
    box("roof", "far", 0, h + 0.1, 0, roofWidth * 0.94, 0.2, roofDepth * 0.94);
    // Parapet and plant: the aerial view is mostly roofs, so they carry the close detail.
    box("trim", "near", 0, h + 0.28, 0, roofWidth * 0.99, 0.16, roofDepth * 0.99);
    box("roof", "near", 0, h + 0.29, 0, roofWidth * 0.9, 0.2, roofDepth * 0.9);
    box(
      "trim",
      "near",
      roofWidth * 0.2,
      h + 0.36,
      -roofDepth * 0.18,
      roofWidth * 0.3,
      0.34,
      roofDepth * 0.26,
    );
    box("roof", "near", -roofWidth * 0.24, h + 0.3, roofDepth * 0.2, roofWidth * 0.18, 0.22, roofDepth * 0.2);
    put("trim", "near", UNIT_CYLINDER_8, -roofWidth * 0.24, h + 0.5, -roofDepth * 0.22, 0.09, 0.5, 0.09);

    // Ubiquitous rooftop water tank, scaled conservatively so it remains a detail rather
    // than a symbol. The ribbed silhouette is made from two cylinders and a small cap.
    if (building.variant !== "tower" || variation % 2 === 0) {
      const tankRadius = Math.min(0.34, Math.max(0.2, Math.min(roofWidth, roofDepth) * 0.11));
      put(
        "roof",
        "near",
        UNIT_CYLINDER_16,
        roofWidth * 0.27,
        h + 0.72,
        roofDepth * 0.24,
        tankRadius,
        0.62,
        tankRadius,
      );
      put(
        "trim",
        "near",
        UNIT_CYLINDER_16,
        roofWidth * 0.27,
        h + 1.055,
        roofDepth * 0.24,
        tankRadius * 0.84,
        0.05,
        tankRadius * 0.84,
      );
    }

    // A pair of tilted solar modules adds a recognisable roof scale and catches the sky.
    if (variation === 1 || variation === 3) {
      for (const offset of [-0.19, 0.19])
        rotatedBox(
          "glass",
          "near",
          offset * roofWidth,
          h + 0.48,
          -roofDepth * 0.18,
          roofWidth * 0.3,
          0.035,
          roofDepth * 0.28,
          -0.28,
        );
    }

    // Rooftop clutter, seeded from the path so each building keeps its own kit. Skylines are
    // read by their tops, and identical flat lids were making every tower the same tower.
    const kit = building.detailSeed;
    if (kit % 3 === 0) {
      // Water tank on a frame.
      const tank = Math.min(roofWidth, roofDepth) * 0.16;
      put("roof", "near", UNIT_CYLINDER_8, roofWidth * 0.24, h + 1.02, roofDepth * 0.24, tank, 0.86, tank);
      for (const side of [-1, 1]) {
        box(
          "trim",
          "near",
          roofWidth * 0.24 + side * tank * 0.6,
          h + 0.45,
          roofDepth * 0.24,
          0.05,
          0.5,
          0.05,
        );
      }
    }
    if (kit % 3 === 1) {
      // Lattice mast with an aircraft light at the top.
      box("trim", "near", -roofWidth * 0.3, h + 1.05, roofDepth * 0.26, 0.06, 1.7, 0.06);
      box("trim", "near", -roofWidth * 0.3, h + 1.3, roofDepth * 0.26, 0.34, 0.04, 0.04);
      put("light", "near", UNIT_CYLINDER_8, -roofWidth * 0.3, h + 1.94, roofDepth * 0.26, 0.05, 0.1, 0.05);
    }
    if (kit % 4 === 2) {
      // A pair of chiller units.
      for (const offset of [-0.22, 0.1]) {
        box(
          "roof",
          "near",
          roofWidth * offset,
          h + 0.42,
          -roofDepth * 0.3,
          roofWidth * 0.22,
          0.26,
          roofDepth * 0.2,
        );
      }
    }

    if (profile.crown === "spire") {
      put("trim", "far", UNIT_CYLINDER_8, 0, h + 0.62, 0, roofWidth * 0.15, 0.52, roofWidth * 0.15);
      put("light", "far", UNIT_CYLINDER_8, 0, h + 1.24, 0, 0.035, 0.74, 0.035);
    }
    if (profile.crown === "vents") {
      for (const offset of [-0.28, 0, 0.28])
        put("roof", "far", UNIT_CYLINDER_8, roofWidth * offset, h + 0.56, roofDepth * 0.22, 0.12, 0.58, 0.12);
    }
    if (profile.crown === "dome") {
      const drum = Math.min(roofWidth, roofDepth);
      put("trim", "far", UNIT_CYLINDER_16, 0, h + 0.44, 0, drum * 0.2, 0.38, drum * 0.2);
      put("glass", "far", UNIT_CYLINDER_16, 0, h + 0.66, 0, drum * 0.17, 0.12, drum * 0.17);
    }
    if (profile.crown === "terrace") {
      box("facade", "far", 0, h + 0.42, 0, roofWidth * 0.62, 0.32, roofDepth * 0.66);
      box("trim", "far", 0, h + 0.62, 0, roofWidth * 0.7, 0.06, roofDepth * 0.74);
    }
    if (profile.crown === "library")
      box("glass", "far", 0, h + 0.44, 0, roofWidth * 0.72, 0.34, roofDepth * 0.72);
  }

  return parts;
}

function mergeParts(parts: Part[]): AssembledBuilding | null {
  const kinds: SurfaceKind[] = [];
  const groups: BufferGeometry[] = [];

  for (const kind of SURFACE_KINDS) {
    const slice = parts.filter((part) => part.kind === kind);
    if (!slice.length) continue;
    const transformed = slice.map((part) => part.geometry.clone().applyMatrix4(part.matrix));
    const merged = mergeGeometries(transformed);
    for (const geometry of transformed) geometry.dispose();
    if (!merged) continue;
    kinds.push(kind);
    groups.push(merged);
  }

  if (!groups.length) return null;
  const geometry = mergeGeometries(groups, true);
  for (const group of groups) group.dispose();
  if (!geometry) return null;
  geometry.computeBoundingSphere();
  return { geometry, kinds };
}

/**
 * Two levels of detail sharing one description: the near one keeps entrances, fins and
 * rooftop plant, the far one drops them. Both are a single mesh with one group per
 * surface, so a building costs four or five draws instead of thirty.
 */
export function assembleBuilding(building: CityBuilding, width: number, depth: number, height: number) {
  const parts = describe(building, width, depth, height);
  return {
    near: mergeParts(parts),
    far: mergeParts(parts.filter((part) => part.tier === "far")),
  };
}
