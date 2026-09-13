import { create } from "zustand";

import { getDemoCity } from "@/lib/city/demo-city";
import type {
  AnalyzeRepositoryResponse,
  CityLayer,
  CityModel,
  CityQuality,
  CityViewMode,
  CityVisualMode,
} from "@/types/city";

type AnalysisStatus = "idle" | "loading" | "ready" | "error";

/**
 * Everything a building needs to know about the repository's history, resolved once per
 * city instead of re-derived inside all hundred-odd buildings on every render.
 */
export interface DerivedBuildingState {
  existsAtTime: boolean;
  inCycle: boolean;
  recentRepair: boolean;
  pullStatus: string | null;
}

const NEUTRAL_STATE: DerivedBuildingState = {
  existsAtTime: true,
  inCycle: false,
  recentRepair: false,
  pullStatus: null,
};

interface CityState {
  status: AnalysisStatus;
  city: CityModel;
  /** True while `city` is the offline sample rather than an analysed repository. */
  isDemo: boolean;
  baselineCity: CityModel | null;
  repositoryUrl: string;
  error: string | null;
  selectedBuildingId: string | null;
  viewMode: CityViewMode;
  focusVersion: number;
  layer: CityLayer;
  activePullRequest: number | null;
  timelineIndex: number;
  visualMode: CityVisualMode;
  quality: CityQuality;
  cinematicVersion: number;
  photoVersion: number;
  derived: Map<string, DerivedBuildingState>;
  analyzeRepository: (url: string) => Promise<void>;
  reset: () => void;
  selectBuilding: (buildingId: string | null) => void;
  focusBuilding: (buildingId: string) => void;
  setViewMode: (mode: CityViewMode) => void;
  setLayer: (layer: CityLayer) => void;
  setActivePullRequest: (number: number | null) => void;
  setTimelineIndex: (index: number) => void;
  setVisualMode: (mode: CityVisualMode) => void;
  setQuality: (quality: CityQuality) => void;
  startCinematicTour: () => void;
  requestPhoto: () => void;
  beginComparison: () => void;
  clearComparison: () => void;
  loadDemo: () => void;
}

const REPAIR_MESSAGE = /\b(fix|bug|repair|patch)\b/i;

function deriveBuildingStates(city: CityModel, timelineIndex: number, activePullRequest: number | null) {
  const states = new Map<string, DerivedBuildingState>();
  const commits = [...city.insights.commits].sort((a, b) => a.date.localeCompare(b.date));
  const threshold =
    commits[Math.min(commits.length - 1, Math.floor((timelineIndex / 100) * commits.length))]?.date;

  const cycled = new Set(city.cycles.flat());
  const repaired = new Set<string>();
  for (const commit of commits) {
    if (!REPAIR_MESSAGE.test(commit.message)) continue;
    for (const file of commit.files) repaired.add(file.path);
  }

  const pullRequest = city.insights.pullRequests.find((pull) => pull.number === activePullRequest);
  const pullByPath = new Map(pullRequest?.files.map((file) => [file.path, file.status]) ?? []);

  for (const building of city.buildings) {
    states.set(building.id, {
      existsAtTime:
        !threshold || !building.metrics.introducedAt || building.metrics.introducedAt <= threshold,
      inCycle: cycled.has(building.id),
      recentRepair: repaired.has(building.path),
      pullStatus: pullByPath.get(building.path) ?? null,
    });
  }

  return states;
}

/** Subscribe a single building to only its own slice of the derived state. */
export function useBuildingState(buildingId: string) {
  return useCityStore((state) => state.derived.get(buildingId)) ?? NEUTRAL_STATE;
}

let activeRequest: AbortController | null = null;

const initialCity = getDemoCity();

export const useCityStore = create<CityState>((set) => ({
  // Open on the landing over a live preview of the demo city, not straight into it.
  status: "idle",
  city: initialCity,
  isDemo: true,
  baselineCity: null,
  repositoryUrl: "",
  error: null,
  selectedBuildingId: null,
  viewMode: "map",
  focusVersion: 0,
  layer: "structure",
  activePullRequest: null,
  timelineIndex: 100,
  visualMode: "day",
  quality: "auto",
  cinematicVersion: 0,
  photoVersion: 0,
  derived: deriveBuildingStates(initialCity, 100, null),

  analyzeRepository: async (repositoryUrl) => {
    activeRequest?.abort();
    activeRequest = new AbortController();

    // Only per-city state is cleared here; visual mode, quality and layer belong to the
    // person, not to the repository being analysed.
    set({
      status: "loading",
      repositoryUrl,
      error: null,
      selectedBuildingId: null,
      viewMode: "map",
      activePullRequest: null,
      timelineIndex: 100,
    });

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: repositoryUrl }),
        signal: activeRequest.signal,
      });
      const payload = (await response.json()) as AnalyzeRepositoryResponse & { error?: string };

      if (!response.ok || !payload.city) {
        throw new Error(payload.error ?? "No pudimos construir la ciudad de este repositorio.");
      }

      set({
        status: "ready",
        city: payload.city,
        isDemo: false,
        error: null,
        selectedBuildingId: null,
        viewMode: "map",
        focusVersion: 0,
        activePullRequest: null,
        timelineIndex: 100,
        derived: deriveBuildingStates(payload.city, 100, null),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;

      set({
        status: "error",
        error: error instanceof Error ? error.message : "No pudimos analizar el repositorio.",
      });
    } finally {
      activeRequest = null;
    }
  },

  reset: () => {
    activeRequest?.abort();
    activeRequest = null;
    const demo = getDemoCity();
    set({
      status: "idle",
      city: demo,
      isDemo: true,
      repositoryUrl: "",
      error: null,
      selectedBuildingId: null,
      viewMode: "map",
      focusVersion: 0,
      layer: "structure",
      activePullRequest: null,
      timelineIndex: 100,
      derived: deriveBuildingStates(demo, 100, null),
    });
  },

  selectBuilding: (selectedBuildingId) => set({ selectedBuildingId }),
  focusBuilding: (selectedBuildingId) =>
    set((state) => ({
      selectedBuildingId,
      viewMode: "map",
      focusVersion: state.focusVersion + 1,
    })),
  setViewMode: (viewMode) => set({ viewMode }),
  setLayer: (layer) =>
    set((state) => ({
      layer,
      activePullRequest: null,
      derived: deriveBuildingStates(state.city, state.timelineIndex, null),
    })),
  setActivePullRequest: (activePullRequest) =>
    set((state) => ({
      activePullRequest,
      layer: "activity",
      derived: deriveBuildingStates(state.city, state.timelineIndex, activePullRequest),
    })),
  setTimelineIndex: (timelineIndex) =>
    set((state) => ({
      timelineIndex,
      activePullRequest: null,
      layer: "activity",
      derived: deriveBuildingStates(state.city, timelineIndex, null),
    })),
  setVisualMode: (visualMode) => set({ visualMode }),
  setQuality: (quality) => set({ quality }),
  startCinematicTour: () =>
    set((state) => ({ viewMode: "map", cinematicVersion: state.cinematicVersion + 1 })),
  requestPhoto: () => set((state) => ({ photoVersion: state.photoVersion + 1 })),
  beginComparison: () =>
    set((state) => {
      if (state.isDemo) return state;
      const demo = getDemoCity();
      return {
        baselineCity: state.city,
        city: demo,
        isDemo: true,
        status: "idle",
        repositoryUrl: "",
        selectedBuildingId: null,
        viewMode: "map",
        derived: deriveBuildingStates(demo, 100, null),
      };
    }),
  clearComparison: () => set({ baselineCity: null }),
  loadDemo: () => {
    const demo = getDemoCity();
    set({
      status: "ready",
      city: demo,
      isDemo: true,
      selectedBuildingId: null,
      viewMode: "map",
      layer: "structure",
      timelineIndex: 100,
      activePullRequest: null,
      error: null,
      derived: deriveBuildingStates(demo, 100, null),
    });
  },
}));

/** Kept out of the store so callers that only need the model do not subscribe to it. */
export const currentCity = () => useCityStore.getState().city;
