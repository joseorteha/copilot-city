import { CanvasTexture, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, type Texture } from "three";

export type RoadMapKind = "albedo" | "roughness" | "height";

function noise(index: number, salt: number) {
  const value = Math.sin(index * 91.731 + salt * 41.17) * 43758.5453;
  return value - Math.floor(value);
}

function paint(kind: RoadMapKind) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) return canvas;

  const base = kind === "albedo" ? 70 : kind === "roughness" ? 205 : 128;
  context.fillStyle = `rgb(${base},${base + (kind === "albedo" ? 4 : 0)},${base + (kind === "albedo" ? 3 : 0)})`;
  context.fillRect(0, 0, 512, 512);

  // Fine aggregate and repaired patches. Large contrast would look like camouflage from
  // the map camera, so each mark stays within a deliberately narrow tonal range.
  for (let index = 0; index < 2600; index += 1) {
    const x = Math.floor(noise(index, 1) * 512);
    const y = Math.floor(noise(index, 2) * 512);
    const radius = 0.35 + noise(index, 3) * 1.4;
    const delta = Math.round((noise(index, 4) - 0.5) * (kind === "height" ? 20 : 14));
    const tone = Math.max(0, Math.min(255, base + delta));
    context.fillStyle = `rgba(${tone},${tone},${tone},${0.22 + noise(index, 5) * 0.35})`;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  for (let patch = 0; patch < 8; patch += 1) {
    const x = noise(patch, 31) * 470;
    const y = noise(patch, 32) * 470;
    const w = 18 + noise(patch, 33) * 54;
    const h = 6 + noise(patch, 34) * 22;
    const tone = kind === "roughness" ? 176 : kind === "height" ? 119 : 57;
    context.fillStyle = `rgba(${tone},${tone},${tone},0.16)`;
    context.fillRect(x, y, w, h);
  }

  return canvas;
}

const cache = new Map<RoadMapKind, Texture | null>();

export function roadTexture(kind: RoadMapKind) {
  if (typeof document === "undefined") return null;
  const cached = cache.get(kind);
  if (cached !== undefined) return cached;
  const texture = new CanvasTexture(paint(kind));
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(8, 8);
  texture.anisotropy = 4;
  texture.minFilter = LinearMipmapLinearFilter;
  if (kind === "albedo") texture.colorSpace = SRGBColorSpace;
  cache.set(kind, texture);
  return texture;
}
