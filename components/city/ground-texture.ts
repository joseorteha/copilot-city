import { CanvasTexture, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace } from "three";

const SIZE = 512;

function noise(x: number, y: number, salt: number) {
  const value = Math.sin(x * 12.9898 + y * 78.233 + salt * 43.1) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Terrain detail. The ground was a single flat vertex-coloured plane, which is most of why
 * the render read as untextured: at any distance the eye had nothing to measure scale
 * against. This tiles densely enough to break that up without a single asset download.
 */
function paintGround() {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext("2d");
  if (!context) return canvas;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, SIZE, SIZE);

  // Broad patches first: dry ground showing through, then wetter hollows.
  for (let index = 0; index < 120; index += 1) {
    const x = noise(index, 1, 3) * SIZE;
    const y = noise(index, 2, 7) * SIZE;
    const radius = 10 + noise(index, 3, 11) * 96;
    const warm = noise(index, 4, 17) > 0.5;
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, warm ? "rgba(210,198,157,.12)" : "rgba(86,125,94,.14)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  // Then fine speckle, which is what actually survives minification into a grass-like grain.
  const image = context.getImageData(0, 0, SIZE, SIZE);
  const pixels = image.data;
  for (let index = 0; index < pixels.length; index += 4) {
    const pixel = index / 4;
    const grain = (noise(pixel % SIZE, Math.floor(pixel / SIZE), 29) - 0.5) * 10;
    pixels[index] = Math.max(0, Math.min(255, pixels[index] + grain));
    pixels[index + 1] = Math.max(0, Math.min(255, pixels[index + 1] + grain * 1.15));
    pixels[index + 2] = Math.max(0, Math.min(255, pixels[index + 2] + grain * 0.7));
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

let cached: CanvasTexture | null | undefined;

export function groundTexture(repeat: number) {
  if (typeof document === "undefined") return null;
  if (cached === undefined) {
    cached = new CanvasTexture(paintGround());
    cached.wrapS = RepeatWrapping;
    cached.wrapT = RepeatWrapping;
    cached.colorSpace = SRGBColorSpace;
    cached.anisotropy = 4;
    cached.minFilter = LinearMipmapLinearFilter;
  }
  if (!cached) return null;
  const texture = cached.clone();
  texture.repeat.set(repeat, repeat);
  texture.needsUpdate = true;
  return texture;
}
