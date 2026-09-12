import { create } from "zustand";

import type { AnalyzeRepositoryResponse, CityLayer, CityModel, CityQuality, CityViewMode, CityVisualMode } from "@/types/city";

type AnalysisStatus = "idle" | "loading" | "ready" | "error";

interface CityState {
  status: AnalysisStatus;
  city: CityModel | null;
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
  startedAt: number | null;
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
}

let activeRequest: AbortController | null = null;

export const useCityStore = create<CityState>((set) => ({
  status: "idle",
  city: null,
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
  startedAt: null,

  analyzeRepository: async (repositoryUrl) => {
    activeRequest?.abort();
    activeRequest = new AbortController();

    set({
      status: "loading",
      repositoryUrl,
      error: null,
      selectedBuildingId: null,
      viewMode: "map",
      layer: "structure",
      activePullRequest: null,
      timelineIndex: 100,
      visualMode: "day",
      startedAt: Date.now(),
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
        error: null,
        selectedBuildingId: null,
        viewMode: "map",
        focusVersion: 0,
        layer: "structure",
        activePullRequest: null,
        timelineIndex: 100,
        visualMode: "day",
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
    set({
      status: "idle",
      city: null,
      repositoryUrl: "",
      error: null,
      selectedBuildingId: null,
      viewMode: "map",
      focusVersion: 0,
      layer: "structure",
      activePullRequest: null,
      timelineIndex: 100,
      visualMode: "day",
      startedAt: null,
    });
  },

  selectBuilding: (selectedBuildingId) => set({ selectedBuildingId }),
  focusBuilding: (selectedBuildingId) => set((state) => ({
    selectedBuildingId,
    viewMode: "map",
    focusVersion: state.focusVersion + 1,
  })),
  setViewMode: (viewMode) => set({ viewMode }),
  setLayer: (layer) => set({ layer, activePullRequest: null }),
  setActivePullRequest: (activePullRequest) => set({ activePullRequest, layer: "activity" }),
  setTimelineIndex: (timelineIndex) => set({ timelineIndex, activePullRequest: null, layer: "activity" }),
  setVisualMode: (visualMode) => set({ visualMode }),
  setQuality: (quality) => set({ quality }),
  startCinematicTour: () => set((state) => ({ viewMode: "map", cinematicVersion: state.cinematicVersion + 1 })),
  requestPhoto: () => set((state) => ({ photoVersion: state.photoVersion + 1 })),
  beginComparison: () => set((state) => state.city ? ({
    baselineCity: state.city,
    city: null,
    status: "idle",
    repositoryUrl: "",
    selectedBuildingId: null,
    viewMode: "map",
  }) : state),
  clearComparison: () => set({ baselineCity: null }),
}));
