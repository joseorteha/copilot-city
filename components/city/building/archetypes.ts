import type { BuildingVariant, CityBuilding } from "@/types/city";

export interface BuildingProfile {
  taper: number;
  crown: "flat" | "spire" | "terrace" | "vents" | "dome" | "library";
  fins: boolean;
  wings: boolean;
  windowDensity: number;
  facade: "grid" | "ribbon" | "vertical" | "open" | "technical" | "curtain";
  footprint: "slab" | "terraced" | "courtyard" | "twin" | "pavilion";
}

const profiles: Record<BuildingVariant, BuildingProfile> = {
  office: {
    taper: 0.96,
    crown: "flat",
    fins: true,
    wings: false,
    windowDensity: 1,
    facade: "curtain",
    footprint: "slab",
  },
  tower: {
    taper: 0.78,
    crown: "spire",
    fins: true,
    wings: false,
    windowDensity: 1.2,
    facade: "curtain",
    footprint: "terraced",
  },
  terrace: {
    taper: 0.9,
    crown: "terrace",
    fins: false,
    wings: true,
    windowDensity: 0.9,
    facade: "ribbon",
    footprint: "terraced",
  },
  corner: {
    taper: 0.94,
    crown: "flat",
    fins: true,
    wings: true,
    windowDensity: 0.9,
    facade: "grid",
    footprint: "courtyard",
  },
  landmark: {
    taper: 0.72,
    crown: "spire",
    fins: true,
    wings: true,
    windowDensity: 1.15,
    facade: "curtain",
    footprint: "twin",
  },
  industrial: {
    taper: 1,
    crown: "vents",
    fins: false,
    wings: true,
    windowDensity: 0.55,
    facade: "technical",
    footprint: "slab",
  },
  laboratory: {
    taper: 0.88,
    crown: "dome",
    fins: true,
    wings: true,
    windowDensity: 0.75,
    facade: "ribbon",
    footprint: "courtyard",
  },
  library: {
    taper: 0.96,
    crown: "library",
    fins: true,
    wings: true,
    windowDensity: 0.7,
    facade: "open",
    footprint: "pavilion",
  },
  "data-center": {
    taper: 1,
    crown: "vents",
    fins: false,
    wings: false,
    windowDensity: 0.35,
    facade: "technical",
    footprint: "slab",
  },
  "service-hub": {
    taper: 0.8,
    crown: "flat",
    fins: true,
    wings: false,
    windowDensity: 1,
    facade: "ribbon",
    footprint: "terraced",
  },
  security: {
    taper: 0.82,
    crown: "flat",
    fins: false,
    wings: false,
    windowDensity: 0.45,
    facade: "technical",
    footprint: "courtyard",
  },
};

export function profileFor(building: CityBuilding) {
  return profiles[building.variant];
}
