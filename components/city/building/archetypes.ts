import type { BuildingVariant, CityBuilding } from "@/types/city";

export interface BuildingProfile {
  taper: number;
  crown: "flat" | "spire" | "terrace" | "vents" | "dome" | "library";
  fins: boolean;
  wings: boolean;
  windowDensity: number;
}

const profiles: Record<BuildingVariant, BuildingProfile> = {
  office: { taper: 0.96, crown: "flat", fins: true, wings: false, windowDensity: 1 },
  tower: { taper: 0.78, crown: "spire", fins: true, wings: false, windowDensity: 1.2 },
  terrace: { taper: 0.9, crown: "terrace", fins: false, wings: true, windowDensity: 0.9 },
  corner: { taper: 0.94, crown: "flat", fins: true, wings: true, windowDensity: 0.9 },
  landmark: { taper: 0.72, crown: "spire", fins: true, wings: true, windowDensity: 1.15 },
  industrial: { taper: 1, crown: "vents", fins: false, wings: true, windowDensity: 0.55 },
  laboratory: { taper: 0.88, crown: "dome", fins: true, wings: true, windowDensity: 0.75 },
  library: { taper: 0.96, crown: "library", fins: true, wings: true, windowDensity: 0.7 },
};

export function profileFor(building: CityBuilding) {
  return profiles[building.variant];
}
