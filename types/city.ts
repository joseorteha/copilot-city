import type { AnalysisDiagnostics, CommitInsight, ContributorInsight, PullRequestInsight, RepositoryMetadata } from "@/types/repository";

export type BuildingVariant =
  | "office"
  | "tower"
  | "terrace"
  | "corner"
  | "landmark"
  | "industrial"
  | "laboratory"
  | "library";

export type BuildingTone = "stone" | "brick" | "concrete" | "sand" | "slate";
export type DistrictPurpose = "frontend" | "services" | "data" | "tests" | "docs" | "infrastructure" | "general";
export type CityViewMode = "map" | "explore";
export type CityVisualMode = "day" | "night";
export type CityQuality = "auto" | "high" | "low";
export type CityLayer = "structure" | "complexity" | "activity" | "dependencies" | "risk" | "ownership";
export type Position3D = [number, number, number];
export type Position2D = [number, number];

export interface BuildingMetrics {
  size: number;
  lines: number;
  complexity: number;
  dependencies: number;
  dependents: number;
  language: string;
  recentChanges: number;
  additions: number;
  deletions: number;
  risk: number;
  lastChangedAt: string | null;
  primaryAuthor: string | null;
  introducedAt: string | null;
}

export interface CityBuilding {
  id: string;
  nodeId: string;
  name: string;
  path: string;
  districtId: string;
  position: Position3D;
  rotation: number;
  width: number;
  depth: number;
  height: number;
  floors: number;
  variant: BuildingVariant;
  tone: BuildingTone;
  importance: number;
  isLandmark: boolean;
  codePreview: string | null;
  metrics: BuildingMetrics;
}

export interface CityDistrict {
  id: string;
  name: string;
  position: Position2D;
  size: Position2D;
  color: string;
  buildingCount: number;
  purpose: DistrictPurpose;
  plazaPosition: Position2D;
}

export interface CityConnection {
  id: string;
  sourceBuildingId: string;
  targetBuildingId: string;
  source: Position2D;
  target: Position2D;
  specifier: string;
  type: "import" | "require" | "dynamic-import";
  crossDistrict: boolean;
}

export interface CityRoad {
  id: string;
  from: Position2D;
  to: Position2D;
  width: number;
  strength: number;
  kind: "street" | "avenue" | "bridge";
  districts: [string, string];
}

export interface CityBounds {
  width: number;
  depth: number;
  radius: number;
}

export interface CityStats {
  files: number;
  districts: number;
  dependencies: number;
  languages: number;
}

export interface CityModel {
  repository: RepositoryMetadata;
  diagnostics: AnalysisDiagnostics;
  buildings: CityBuilding[];
  districts: CityDistrict[];
  roads: CityRoad[];
  connections: CityConnection[];
  coreBuildingId: string;
  cycles: string[][];
  insights: {
    commits: CommitInsight[];
    pullRequests: PullRequestInsight[];
    contributors: ContributorInsight[];
    ci: { status: string; conclusion: string | null; name: string; htmlUrl: string; updatedAt: string } | null;
  };
  bounds: CityBounds;
  stats: CityStats;
}

export interface AnalyzeRepositoryResponse {
  city: CityModel;
}
