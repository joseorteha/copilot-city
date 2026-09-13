import type { CityDistrict } from "@/types/city";

/** Urban plateaus blend into gently rolling terrain; the same function serves navigation. */
export function terrainHeight(x: number, z: number, districts: CityDistrict[]) {
  let distance = Infinity;
  for (const district of districts) {
    distance = Math.min(
      distance,
      Math.hypot(
        Math.max(0, Math.abs(x - district.position[0]) - district.size[0] / 2 - 3),
        Math.max(0, Math.abs(z - district.position[1]) - district.size[1] / 2 - 3),
      ),
    );
  }
  const blend = Math.min(1, distance / 16);
  return -0.12 - blend * (0.8 + 0.6 * Math.sin(x * 0.045) * Math.cos(z * 0.038));
}
