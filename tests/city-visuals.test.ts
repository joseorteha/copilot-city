import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { assembleBuilding } from "@/components/city/building/assemble";
import { getDemoCity } from "@/lib/city/demo-city";
import type { BuildingVariant, CityBuilding } from "@/types/city";

const VARIANTS: BuildingVariant[] = [
  "office",
  "tower",
  "terrace",
  "corner",
  "landmark",
  "industrial",
  "laboratory",
  "library",
  "data-center",
  "service-hub",
  "security",
];

function validGeometry(building: CityBuilding) {
  const levels = assembleBuilding(building, building.width, building.depth, building.height);
  for (const level of [levels.near, levels.far]) {
    expect(level).not.toBeNull();
    const geometry = level!.geometry;
    const positions = geometry.getAttribute("position");
    const normals = geometry.getAttribute("normal");
    expect(positions.count).toBeGreaterThan(0);
    expect(normals.count).toBe(positions.count);
    for (let index = 0; index < positions.array.length; index += 1)
      expect(Number.isFinite(positions.array[index])).toBe(true);
    for (let index = 0; index < normals.array.length; index += 1)
      expect(Number.isFinite(normals.array[index])).toBe(true);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox?.isEmpty()).toBe(false);
  }
  return levels;
}

describe("procedural visual kit", () => {
  it("produces finite near and far geometry for all eleven semantic archetypes", () => {
    const template = getDemoCity().buildings[0];
    expect(template).toBeDefined();
    const signatures = new Set<string>();

    VARIANTS.forEach((variant, index) => {
      const building: CityBuilding = {
        ...template,
        id: `visual:${variant}`,
        name: variant,
        path: `visual/${variant}.ts`,
        variant,
        detailSeed: index,
        width: 3.2 + (index % 3) * 0.35,
        depth: 2.8 + (index % 4) * 0.28,
        height: 7.5 + index * 0.6,
      };
      const levels = validGeometry(building);
      signatures.add(
        `${levels.near!.geometry.getAttribute("position").count}:${levels.near!.kinds.join(",")}`,
      );
      levels.near?.geometry.dispose();
      levels.far?.geometry.dispose();
    });

    expect(signatures.size).toBeGreaterThanOrEqual(8);
  }, 10_000);

  it("keeps a building variation deterministic", () => {
    const building = { ...getDemoCity().buildings[3], detailSeed: 73 };
    const first = validGeometry(building);
    const second = validGeometry(building);
    const a = first.near!.geometry.getAttribute("position").array;
    const b = second.near!.geometry.getAttribute("position").array;
    expect(Array.from(a)).toEqual(Array.from(b));
    first.near?.geometry.dispose();
    first.far?.geometry.dispose();
    second.near?.geometry.dispose();
    second.far?.geometry.dispose();
  });
});

describe("third-party visual assets", () => {
  it("ships every local asset declared in the CC0 manifest", async () => {
    const root = join(process.cwd(), "public", "assets", "city");
    const manifest = JSON.parse(await readFile(join(root, "assets.json"), "utf8")) as {
      assets: Array<{ path: string; source: string; license: string; bytes: number }>;
    };
    expect(manifest.assets.length).toBeGreaterThanOrEqual(6);
    expect(new Set(manifest.assets.map((asset) => asset.path)).size).toBe(manifest.assets.length);

    for (const asset of manifest.assets) {
      expect(asset.license).toBe("CC0-1.0");
      expect(asset.source).toMatch(/^https:\/\//);
      expect((await stat(join(root, asset.path))).size).toBe(asset.bytes);
    }
  });
});
