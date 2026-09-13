"use client";

import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Camera,
  Check,
  CircleAlert,
  Code2,
  Crown,
  Download,
  ExternalLink,
  Film,
  Footprints,
  Gauge,
  GitCompareArrows,
  Github,
  Layers3,
  LocateFixed,
  Map,
  MapPinned,
  Moon,
  Route,
  Search,
  Sparkles,
  Sun,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CityErrorBoundary } from "@/components/city/CityErrorBoundary";
import { DragHandle, useDraggable } from "@/components/ui/draggable";
import { CityIntelligence } from "@/components/panels/CityIntelligence";
import { CityMinimap } from "@/components/panels/CityMinimap";
import { ARCHETYPE_LABELS } from "@/lib/city/buildings";
import { useCityStore } from "@/store/city-store";
import type { CityLayer } from "@/types/city";

/**
 * three, drei and postprocessing are ~390 kB and nothing above the fold needs them, so the
 * welcome panel paints first and the engine arrives behind it.
 */
const CityScene = dynamic(() => import("@/components/city/CityScene").then((module) => module.CityScene), {
  ssr: false,
  loading: () => <div className="scene-skeleton" aria-hidden="true" />,
});

const EXAMPLE_REPOSITORY = "https://github.com/shadcn-ui/ui";
const LAYER_ORDER: CityLayer[] = [
  "structure",
  "complexity",
  "activity",
  "dependencies",
  "risk",
  "ownership",
  "tests",
  "core",
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-MX", { notation: value > 9_999 ? "compact" : "standard" }).format(value);
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function useOptionalCityAmbience(active: boolean) {
  const [enabled, setEnabled] = useState(false);
  const audio = useRef<{ context: AudioContext; sources: AudioScheduledSourceNode[] } | null>(null);

  const stop = useCallback(() => {
    audio.current?.sources.forEach((source) => {
      try {
        source.stop();
      } catch {
        // A source may already have stopped while the page was backgrounded.
      }
    });
    void audio.current?.context.close();
    audio.current = null;
    setEnabled(false);
  }, []);

  const toggle = useCallback(() => {
    if (audio.current) {
      stop();
      return;
    }
    const context = new AudioContext();
    const master = context.createGain();
    master.gain.value = 0.032;
    master.connect(context.destination);

    const seconds = 3;
    const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate);
    const data = buffer.getChannelData(0);
    let previous = 0;
    for (let index = 0; index < data.length; index += 1) {
      const white = Math.random() * 2 - 1;
      previous = (previous + 0.018 * white) / 1.018;
      data[index] = previous * 2.4;
    }
    const wind = context.createBufferSource();
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 520;
    filter.Q.value = 0.35;
    wind.buffer = buffer;
    wind.loop = true;
    wind.connect(filter).connect(master);

    const cityHum = context.createOscillator();
    const humGain = context.createGain();
    cityHum.type = "sine";
    cityHum.frequency.value = 54;
    humGain.gain.value = 0.06;
    cityHum.connect(humGain).connect(master);
    wind.start();
    cityHum.start();
    void context.resume();
    audio.current = { context, sources: [wind, cityHum] };
    setEnabled(true);
  }, [stop]);

  useEffect(() => {
    if (!active && audio.current) stop();
    return () => {
      if (audio.current) stop();
    };
  }, [active, stop]);
  return { enabled, toggle };
}

export function CityExperience() {
  const status = useCityStore((state) => state.status);
  const city = useCityStore((state) => state.city);
  const isDemo = useCityStore((state) => state.isDemo);
  const baselineCity = useCityStore((state) => state.baselineCity);
  const error = useCityStore((state) => state.error);
  const repositoryUrl = useCityStore((state) => state.repositoryUrl);
  const selectedBuildingId = useCityStore((state) => state.selectedBuildingId);
  const viewMode = useCityStore((state) => state.viewMode);
  const visualMode = useCityStore((state) => state.visualMode);
  const quality = useCityStore((state) => state.quality);
  const analyzeRepository = useCityStore((state) => state.analyzeRepository);
  const reset = useCityStore((state) => state.reset);
  const selectBuilding = useCityStore((state) => state.selectBuilding);
  const focusBuilding = useCityStore((state) => state.focusBuilding);
  const setViewMode = useCityStore((state) => state.setViewMode);
  const setLayer = useCityStore((state) => state.setLayer);
  const loadDemo = useCityStore((state) => state.loadDemo);
  const setVisualMode = useCityStore((state) => state.setVisualMode);
  const setQuality = useCityStore((state) => state.setQuality);
  const startCinematicTour = useCityStore((state) => state.startCinematicTour);
  const requestPhoto = useCityStore((state) => state.requestPhoto);
  const beginComparison = useCityStore((state) => state.beginComparison);
  const clearComparison = useCityStore((state) => state.clearComparison);
  const [url, setUrl] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [intelligenceOpen, setIntelligenceOpen] = useState(false);
  const [intelligenceTab, setIntelligenceTab] = useState<"layers" | "git">("layers");
  const [query, setQuery] = useState("");
  const [hintDismissed, setHintDismissed] = useState(false);
  const [minimapOpen, setMinimapOpen] = useState(true);
  const ambience = useOptionalCityAmbience(status === "ready");
  const inspectorDrag = useDraggable();
  const searchDrag = useDraggable();
  const [exportState, setExportState] = useState<{
    status: "idle" | "loading" | "done" | "error";
    message: string;
  }>({ status: "idle", message: "" });
  const activeCity = city;
  const selectedBuilding = useMemo(
    () => activeCity.buildings.find((building) => building.id === selectedBuildingId) ?? null,
    [activeCity, selectedBuildingId],
  );
  const coreBuilding = activeCity.buildings.find((building) => building.id === activeCity.coreBuildingId);
  const searchResults = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return activeCity.buildings.slice(0, 8);
    return activeCity.buildings
      .filter(
        (building) =>
          building.name.toLowerCase().includes(term) || building.path.toLowerCase().includes(term),
      )
      .sort(
        (a, b) =>
          Number(b.name.toLowerCase().startsWith(term)) - Number(a.name.toLowerCase().startsWith(term)),
      )
      .slice(0, 10);
  }, [activeCity, query]);
  const relationships = useMemo(() => {
    if (!selectedBuildingId) return [];
    return activeCity.connections
      .filter(
        (connection) =>
          connection.sourceBuildingId === selectedBuildingId ||
          connection.targetBuildingId === selectedBuildingId,
      )
      .map((connection) => {
        const outgoing = connection.sourceBuildingId === selectedBuildingId;
        const otherId = outgoing ? connection.targetBuildingId : connection.sourceBuildingId;
        return {
          connection,
          outgoing,
          building: activeCity.buildings.find((candidate) => candidate.id === otherId),
        };
      })
      .filter((item) => item.building)
      .slice(0, 8);
  }, [activeCity, selectedBuildingId]);

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    setIntelligenceOpen(false);
  }, []);

  // The city itself can only be reached with a pointer, so the keyboard gets the same
  // actions the toolbar exposes: search is the way in, layers and modes follow.
  useEffect(() => {
    if (status !== "ready") return;
    const isTyping = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "Escape") {
        setSearchOpen(false);
        setIntelligenceOpen(false);
        selectBuilding(null);
        return;
      }
      if (isTyping(event.target)) return;

      if (event.key === "/") {
        event.preventDefault();
        openSearch();
        return;
      }
      if (event.key.toLowerCase() === "d") {
        setVisualMode(visualMode === "day" ? "night" : "day");
        return;
      }
      if (event.key.toLowerCase() === "m") {
        setViewMode(viewMode === "map" ? "explore" : "map");
        return;
      }
      if (event.key.toLowerCase() === "n" && coreBuilding) {
        setLayer("core");
        focusBuilding(coreBuilding.id);
        return;
      }
      const layerIndex = Number(event.key);
      if (layerIndex >= 1 && layerIndex <= LAYER_ORDER.length) setLayer(LAYER_ORDER[layerIndex - 1]);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    coreBuilding,
    focusBuilding,
    openSearch,
    selectBuilding,
    setLayer,
    setViewMode,
    setVisualMode,
    status,
    viewMode,
    visualMode,
  ]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setExportState({ status: "idle", message: "" });
    void analyzeRepository(url);
  };

  const useExample = () => {
    setUrl(EXAMPLE_REPOSITORY);
    setExportState({ status: "idle", message: "" });
    void analyzeRepository(EXAMPLE_REPOSITORY);
  };

  const exportMarkdown = async (targetUrl?: string) => {
    setExportState({ status: "loading", message: "Preparando contexto…" });
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl || repositoryUrl || url || activeCity.repository.htmlUrl }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "No pudimos generar el archivo.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const filename =
        disposition.match(/filename="([^"]+)"/)?.[1] ?? `${activeCity.repository.name}-context.md`;
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(downloadUrl);
      const files = response.headers.get("x-files-included") ?? "";
      const tokens = Number(response.headers.get("x-estimated-tokens") ?? 0).toLocaleString("es-MX");
      setExportState({ status: "done", message: `${files} archivos · ≈${tokens} tokens` });
    } catch (exportError) {
      setExportState({
        status: "error",
        message: exportError instanceof Error ? exportError.message : "No pudimos exportar el contexto.",
      });
    }
  };

  return (
    <main className={`city-app is-${status} mode-${visualMode}${selectedBuilding ? " has-inspector" : ""}`}>
      <div
        className="city-canvas"
        aria-label="Ciudad tridimensional generada desde la arquitectura de código"
      >
        <CityErrorBoundary>
          <CityScene city={activeCity} preview={status === "idle"} />
        </CityErrorBoundary>
      </div>
      <div className="atmosphere" aria-hidden="true" />

      <header className="topbar">
        <button className="brand" onClick={reset} aria-label="Volver al inicio">
          <span className="brand-mark">
            <Building2 size={17} strokeWidth={1.8} />
          </span>
          <span>
            <b>COPILOT</b> CITY
          </span>
        </button>
        <div className="topbar-center">
          <span className="live-dot" />
          {status === "ready" ? activeCity.repository.fullName : "URBANISMO GENERADO POR CÓDIGO"}
        </div>
        <a
          className="github-link"
          href="https://github.com/joseorteha/copilot-city"
          target="_blank"
          rel="noreferrer"
        >
          <Github size={16} /> <span>Repositorio</span>
        </a>
      </header>

      {status === "idle" && (
        <section className="landing">
          <div className="landing-scroll">
            <div className="landing-hero">
              <div className="eyebrow">
                <Sparkles size={13} /> GITHUB → CIUDAD 3D · HECHO CON GITHUB COPILOT
              </div>
              {baselineCity && (
                <div className="comparison-base">
                  <GitCompareArrows size={13} /> Comparando contra <b>{baselineCity.repository.fullName}</b>
                  <button onClick={clearComparison}>
                    <X size={12} />
                  </button>
                </div>
              )}
              <h1>
                No leas tu código.
                <br />
                <span>Recórrelo.</span>
              </h1>
              <p className="landing-lead">
                Copilot City convierte cualquier repositorio de GitHub en una ciudad 3D que puedes explorar.
                Los archivos son edificios, las carpetas distritos y las dependencias trazan las calles.
                Escribe una URL y camina por tu arquitectura en segundos.
              </p>

              <form className="repository-form" onSubmit={submit}>
                <label htmlFor="repository-url">Repositorio público de GitHub</label>
                <div className="input-shell">
                  <Github size={18} />
                  <input
                    id="repository-url"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="github.com/usuario/repositorio"
                    autoComplete="url"
                    spellCheck={false}
                  />
                  <button type="submit" aria-label="Construir ciudad" disabled={!url.trim()}>
                    <span>Construir ciudad</span>
                    <ArrowRight size={17} />
                  </button>
                </div>
              </form>

              <div className="landing-actions">
                <button className="example-button" onClick={useExample}>
                  Probar con un repositorio de ejemplo <ArrowRight size={13} />
                </button>
                <button className="example-button" onClick={loadDemo}>
                  Ver la ciudad de demostración <ArrowRight size={13} />
                </button>
                <button
                  className="quick-export"
                  onClick={() => void exportMarkdown(url)}
                  disabled={!url.trim() || exportState.status === "loading"}
                >
                  <Download size={13} /> Sólo generar contexto .MD
                </button>
              </div>
            </div>

            <div className="landing-map">
              <span className="landing-map-title">Cómo se traduce tu repo</span>
              <ul>
                <li>
                  <span>archivo</span>
                  <i>→</i>
                  <b>edificio</b>
                </li>
                <li>
                  <span>carpeta</span>
                  <i>→</i>
                  <b>distrito</b>
                </li>
                <li>
                  <span>import</span>
                  <i>→</i>
                  <b>calle</b>
                </li>
                <li>
                  <span>más dependido</span>
                  <i>→</i>
                  <b>el corazón de la ciudad</b>
                </li>
              </ul>
            </div>

            <div className="landing-caps">
              <span>Capas de análisis</span>
              <span>Historia de Git</span>
              <span>Pull Requests en vivo</span>
              <span>Export .md para tu IA</span>
            </div>

            <div className="landing-credit">
              <span>Un proyecto de</span>
              <a href="https://x.com/mr_orteega" target="_blank" rel="noreferrer">
                <b>José Ortega</b> · @mr_orteega
              </a>
            </div>
          </div>
        </section>
      )}

      {status === "loading" && (
        <section className="loading-panel" aria-live="polite">
          <div className="scanner">
            <span />
            <Code2 size={25} />
          </div>
          <div className="eyebrow">ANALIZANDO REPOSITORIO</div>
          <h2>Levantando la ciudad</h2>
          <p>{repositoryUrl.replace(/^https?:\/\/(www\.)?/, "")}</p>
          <div className="loading-steps">
            <span className="done">Leyendo estructura</span>
            <span className="active">Trazando distritos</span>
            <span>Construyendo edificios</span>
          </div>
        </section>
      )}

      {status === "error" && (
        <section className="message-panel" role="alert">
          <CircleAlert size={24} />
          <div>
            <span className="eyebrow">NO PUDIMOS CONSTRUIR LA CIUDAD</span>
            <h2>Revisa el repositorio</h2>
            <p>{error}</p>
          </div>
          <button onClick={reset}>Volver a intentar</button>
        </section>
      )}

      {status === "ready" && (
        <>
          <details className="city-summary glass-panel">
            <summary>
              <Building2 size={16} />
              <span>
                {activeCity.repository.name}
                <small>
                  {activeCity.stats.files} edificios · {activeCity.stats.districts} distritos ·{" "}
                  {isDemo ? "Demo sin conexión" : "GitHub"}
                </small>
              </span>
              <span aria-hidden="true">⌄</span>
            </summary>
            <button className="back-button" onClick={reset}>
              <ArrowLeft size={14} /> Otro repositorio
            </button>
            <button className="compare-button" onClick={beginComparison}>
              <GitCompareArrows size={13} /> Comparar con otra ciudad
            </button>
            <div className="repo-heading">
              <span>
                <Github size={18} />
              </span>
              <div>
                <small>{activeCity.repository.owner}</small>
                <h2>{activeCity.repository.name}</h2>
              </div>
            </div>
            {activeCity.repository.description && <p>{activeCity.repository.description}</p>}
            <div className="metric-grid">
              <Metric label="edificios" value={formatNumber(activeCity.stats.files)} />
              <Metric label="distritos" value={activeCity.stats.districts} />
              <Metric label="conexiones" value={formatNumber(activeCity.stats.dependencies)} />
              <Metric label="lenguajes" value={activeCity.stats.languages} />
            </div>
            <button
              className="export-context-button"
              onClick={() => void exportMarkdown()}
              disabled={exportState.status === "loading"}
            >
              {exportState.status === "loading" ? (
                <span className="button-spinner" />
              ) : exportState.status === "done" ? (
                <Check size={15} />
              ) : (
                <Download size={15} />
              )}
              <span>
                <b>{exportState.status === "loading" ? "Generando Markdown" : "Descargar contexto .MD"}</b>
                <small>
                  {exportState.status === "done" ? exportState.message : "Estructura + código listo para IA"}
                </small>
              </span>
            </button>
            {activeCity.diagnostics.truncated && (
              <div className="analysis-note">
                Vista optimizada de los archivos más relevantes del repositorio.
              </div>
            )}
          </details>

          {baselineCity && baselineCity.repository.fullName !== activeCity.repository.fullName && (
            <aside className="comparison-card glass-panel">
              <div>
                <GitCompareArrows size={14} /> COMPARACIÓN
              </div>
              <b>
                {baselineCity.repository.name} → {activeCity.repository.name}
              </b>
              <span>
                Edificios{" "}
                <i>
                  {activeCity.stats.files - baselineCity.stats.files >= 0 ? "+" : ""}
                  {activeCity.stats.files - baselineCity.stats.files}
                </i>
              </span>
              <span>
                Conexiones{" "}
                <i>
                  {activeCity.stats.dependencies - baselineCity.stats.dependencies >= 0 ? "+" : ""}
                  {activeCity.stats.dependencies - baselineCity.stats.dependencies}
                </i>
              </span>
              <span>
                Distritos{" "}
                <i>
                  {activeCity.stats.districts - baselineCity.stats.districts >= 0 ? "+" : ""}
                  {activeCity.stats.districts - baselineCity.stats.districts}
                </i>
              </span>
              <button onClick={clearComparison}>Cerrar comparación</button>
            </aside>
          )}

          <nav className="city-controls glass-panel" aria-label="Herramientas de exploración">
            <button
              className={searchOpen ? "active" : ""}
              onClick={() => {
                setSearchOpen((value) => !value);
                setIntelligenceOpen(false);
              }}
              title="Buscar archivo (tecla /)"
            >
              <Search size={16} />
              <span>Buscar</span>
            </button>
            <button
              className={intelligenceOpen && intelligenceTab === "layers" ? "active" : ""}
              onClick={() => {
                setIntelligenceOpen(!intelligenceOpen || intelligenceTab !== "layers");
                setIntelligenceTab("layers");
                setSearchOpen(false);
                selectBuilding(null);
              }}
            >
              <Layers3 size={16} />
              <span>Capas</span>
            </button>
            <button className={viewMode === "map" ? "active" : ""} onClick={() => setViewMode("map")}>
              <Map size={16} />
              <span>Mapa</span>
            </button>
            <button
              id="explore-lock"
              className={viewMode === "explore" ? "active" : ""}
              onClick={() => setViewMode("explore")}
            >
              <Footprints size={16} />
              <span>Explorar</span>
            </button>
            {coreBuilding && (
              <button
                onClick={() => {
                  setLayer("core");
                  focusBuilding(coreBuilding.id);
                  setIntelligenceOpen(false);
                }}
              >
                <Crown size={16} />
                <span>Corazón</span>
              </button>
            )}
            <button
              onClick={() => {
                setIntelligenceOpen(!intelligenceOpen || intelligenceTab !== "git");
                setIntelligenceTab("git");
                setSearchOpen(false);
                selectBuilding(null);
              }}
            >
              <GitCompareArrows size={16} />
              <span>Git</span>
            </button>
          </nav>

          <nav className="scene-tools" aria-label="Dirección visual">
            <button
              className={minimapOpen ? "active" : ""}
              onClick={() => setMinimapOpen((value) => !value)}
              title={minimapOpen ? "Ocultar minimapa" : "Mostrar minimapa"}
              aria-label={minimapOpen ? "Ocultar minimapa" : "Mostrar minimapa"}
            >
              <MapPinned size={16} />
            </button>
            <button
              className={ambience.enabled ? "active" : ""}
              onClick={ambience.toggle}
              title={ambience.enabled ? "Silenciar ambiente" : "Activar ambiente sonoro"}
              aria-label={ambience.enabled ? "Silenciar ambiente" : "Activar ambiente sonoro"}
            >
              {ambience.enabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button
              onClick={() => setVisualMode(visualMode === "day" ? "night" : "day")}
              title={visualMode === "day" ? "Activar noche analítica" : "Activar luz diurna"}
              aria-label={visualMode === "day" ? "Activar noche analítica" : "Activar luz diurna"}
            >
              {visualMode === "day" ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <button
              onClick={startCinematicTour}
              title="Recorrido cinematográfico"
              aria-label="Iniciar recorrido cinematográfico"
            >
              <Film size={16} />
            </button>
            <button
              onClick={requestPhoto}
              title="Guardar fotografía de la ciudad"
              aria-label="Guardar fotografía"
            >
              <Camera size={16} />
            </button>
            <button
              onClick={() => setQuality(quality === "auto" ? "high" : quality === "high" ? "low" : "auto")}
              title={`Calidad: ${quality}`}
              aria-label={`Cambiar calidad gráfica, actual ${quality}`}
            >
              <Gauge size={16} />
              <small>{quality === "auto" ? "A" : quality === "high" ? "H" : "L"}</small>
            </button>
          </nav>

          {minimapOpen && <CityMinimap city={activeCity} onClose={() => setMinimapOpen(false)} />}

          {intelligenceOpen && !selectedBuilding && (
            <CityIntelligence city={activeCity} tab={intelligenceTab} />
          )}

          {searchOpen && (
            <section className="search-panel glass-panel" style={searchDrag.style}>
              <DragHandle handle={searchDrag.handle} label="Búsqueda" dragging={searchDrag.dragging} />
              <div className="search-heading">
                <Search size={15} />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar archivo o ruta…"
                />
                <button onClick={() => setSearchOpen(false)} aria-label="Cerrar búsqueda">
                  <X size={15} />
                </button>
              </div>
              <div className="search-results">
                {searchResults.map((building) => (
                  <button
                    key={building.id}
                    onClick={() => {
                      focusBuilding(building.id);
                      setSearchOpen(false);
                    }}
                  >
                    <span>
                      <b>{building.name}</b>
                      <small>{building.path}</small>
                    </span>
                    <LocateFixed size={14} />
                  </button>
                ))}
                {searchResults.length === 0 && <p>No encontramos un edificio con ese nombre.</p>}
              </div>
            </section>
          )}

          {selectedBuilding && (
            <aside className="inspector glass-panel" style={inspectorDrag.style}>
              <DragHandle handle={inspectorDrag.handle} label="Inspector" dragging={inspectorDrag.dragging} />
              <button
                className="close-button"
                onClick={() => selectBuilding(null)}
                aria-label="Cerrar inspector"
              >
                <X size={17} />
              </button>
              <div className="inspector-kind">
                {selectedBuilding.id === activeCity.coreBuildingId
                  ? "CORAZÓN DEL SISTEMA"
                  : selectedBuilding.variant === "landmark"
                    ? "LANDMARK"
                    : "EDIFICIO"}
              </div>
              <h2>{selectedBuilding.name}</h2>
              <code>{selectedBuilding.path}</code>
              <div className="inspector-location">
                Distrito <b>{selectedBuilding.districtId}</b>
                <span /> Barrio <b>{selectedBuilding.neighborhoodName}</b>
              </div>
              <div className="importance">
                <span>Relevancia arquitectónica</span>
                <strong>{Math.round(selectedBuilding.importance * 100)}%</strong>
                <div>
                  <i style={{ width: `${Math.max(5, selectedBuilding.importance * 100)}%` }} />
                </div>
              </div>
              <div className="inspector-metrics">
                <Metric label="líneas" value={formatNumber(selectedBuilding.metrics.lines)} />
                <Metric label="complejidad" value={selectedBuilding.metrics.complexity} />
                <Metric label="dependencias" value={selectedBuilding.metrics.dependencies} />
                <Metric label="dependen de él" value={selectedBuilding.metrics.dependents} />
              </div>
              <div className="temporal-metrics">
                <span>
                  Actividad reciente <b>{selectedBuilding.metrics.recentChanges} cambios</b>
                </span>
                <span>
                  Prioridad calculada <b>{Math.round(selectedBuilding.metrics.risk * 100)}%</b>
                </span>
                <span>
                  Autor principal <b>{selectedBuilding.metrics.primaryAuthor ?? "Sin datos"}</b>
                </span>
              </div>
              <div className="building-explanation">
                <Code2 size={15} />
                <p>
                  <b>{ARCHETYPE_LABELS[selectedBuilding.variant]}</b> · {selectedBuilding.floors} niveles. Su
                  escala combina tamaño y complejidad; su centralidad relativa (
                  {Math.round(selectedBuilding.centrality * 100)}%) determina su jerarquía y proximidad a la
                  plaza de <b>{selectedBuilding.districtId}</b>. Las métricas son heurísticas, no una
                  calificación de calidad.
                </p>
              </div>
              <div className="inspector-actions">
                <button onClick={() => focusBuilding(selectedBuilding.id)}>
                  <LocateFixed size={14} /> Enfocar
                </button>
                <a
                  href={`${activeCity.repository.htmlUrl}/blob/${activeCity.repository.defaultBranch}/${selectedBuilding.path}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={14} /> Ver código
                </a>
              </div>
              {selectedBuilding.codePreview && (
                <details className="code-preview">
                  <summary>Vista previa del código</summary>
                  <pre>
                    <code>{selectedBuilding.codePreview}</code>
                  </pre>
                </details>
              )}
              <div className="relations">
                <div className="relations-title">
                  <Route size={13} /> RELACIONES VISIBLES <span>{relationships.length}</span>
                </div>
                {relationships.length ? (
                  relationships.map(
                    ({ connection, outgoing, building }) =>
                      building && (
                        <button key={connection.id} onClick={() => focusBuilding(building.id)}>
                          <i className={outgoing ? "outgoing" : "incoming"}>{outgoing ? "SALE" : "ENTRA"}</i>
                          <span>
                            <b>{building.name}</b>
                            <small>{building.path}</small>
                          </span>
                          <ArrowRight size={13} />
                        </button>
                      ),
                  )
                ) : (
                  <p>Este archivo no tiene relaciones locales detectadas.</p>
                )}
              </div>
            </aside>
          )}

          {!hintDismissed && (
            <div className="explore-hint" role="status">
              {viewMode === "map" ? (
                <>
                  <span>Arrastra para orbitar</span>
                  <i />
                  <span>Rueda para acercar</span>
                  <i />
                  <span>
                    Pulsa <kbd>/</kbd> para buscar
                  </span>
                </>
              ) : (
                <>
                  <span>Haz clic para capturar el mouse</span>
                  <i />
                  <span>WASD para caminar</span>
                  <i />
                  <span>Shift para correr · Esc para salir</span>
                </>
              )}
              <button onClick={() => setHintDismissed(true)} aria-label="Ocultar ayuda de navegación">
                <X size={12} />
              </button>
            </div>
          )}
        </>
      )}

      <a
        className="brand-watermark"
        href="https://x.com/mr_orteega"
        target="_blank"
        rel="noreferrer"
        aria-label="Creado por José Ortega (@mr_orteega)"
      >
        <span>por</span> José Ortega <b>· @mr_orteega</b>
      </a>
      {status === "idle" && (
        <div className="preview-caption">
          <span /> Vista previa · ciudad de demostración
        </div>
      )}
      {(exportState.status === "error" || exportState.status === "done") && (
        <div className={`export-toast ${exportState.status === "error" ? "is-error" : "is-success"}`}>
          {exportState.status === "error" ? <CircleAlert size={14} /> : <Check size={14} />}
          {exportState.message}
          <button onClick={() => setExportState({ status: "idle", message: "" })}>
            <X size={13} />
          </button>
        </div>
      )}
    </main>
  );
}
