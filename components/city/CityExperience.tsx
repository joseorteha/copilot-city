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
  Moon,
  Route,
  Search,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { CityErrorBoundary } from "@/components/city/CityErrorBoundary";
import { DragHandle, useDraggable } from "@/components/ui/draggable";
import { CityIntelligence } from "@/components/panels/CityIntelligence";
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

function FeatureCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Building2;
  title: string;
  children: string;
}) {
  return (
    <div className="landing-feature">
      <span className="landing-feature-icon">
        <Icon size={17} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
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
        <a className="github-link" href="https://github.com" target="_blank" rel="noreferrer">
          <Github size={16} /> <span>GitHub</span>
        </a>
      </header>

      {status === "idle" && (
        <section className="landing">
          <div className="landing-scroll">
            <div className="landing-hero">
              <div className="eyebrow">
                <Sparkles size={13} /> URBANISMO GENERADO POR CÓDIGO
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
                Convierte cualquier repositorio en <span>una ciudad recorrible</span>
              </h1>
              <p className="landing-lead">
                Copilot City lee la arquitectura real de tu proyecto y la construye en 3D: cada archivo es un
                edificio, cada carpeta es un distrito y cada import traza una calle. Escribe una URL de GitHub
                y camina por tu propio código en segundos.
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

            <div className="landing-features">
              <FeatureCard icon={Building2} title="Arquitectura visible">
                El tamaño, la altura y la posición de cada edificio reflejan complejidad, importancia y
                centralidad reales del código, no datos decorativos.
              </FeatureCard>
              <FeatureCard icon={GitCompareArrows} title="Historia y Pull Requests">
                Recorre la línea de tiempo de commits, revisa Pull Requests abiertas y observa cómo cambia el
                skyline con cada entrega.
              </FeatureCard>
              <FeatureCard icon={Layers3} title="Capas de inteligencia">
                Cambia entre estructura, complejidad, riesgo, autoría y tests para leer el mismo repositorio
                desde ángulos distintos.
              </FeatureCard>
              <FeatureCard icon={Download} title="Contexto listo para IA">
                Exporta un Markdown con la estructura y el código relevante del repositorio, listo para
                pegarlo en tu asistente favorito.
              </FeatureCard>
            </div>

            <div className="landing-footer-note">
              Funciona con cualquier repositorio público · No requiere instalación · Datos leídos directamente
              de la API de GitHub
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
