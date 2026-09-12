"use client";

import { ArrowLeft, ArrowRight, Building2, Camera, Check, CircleAlert, Code2, Crown, Download, ExternalLink, FileText, Film, Footprints, Gauge, GitCompareArrows, Github, Layers3, LocateFixed, Map, Moon, Network, Route, Search, Sparkles, Sun, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

import { CityScene } from "@/components/city/CityScene";
import { CityIntelligence } from "@/components/panels/CityIntelligence";
import { demoCity } from "@/lib/city/demo-city";
import { useCityStore } from "@/store/city-store";

const EXAMPLE_REPOSITORY = "https://github.com/shadcn-ui/ui";

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-MX", { notation: value > 9_999 ? "compact" : "standard" }).format(value);
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="metric"><strong>{value}</strong><span>{label}</span></div>;
}

export function CityExperience() {
  const status = useCityStore((state) => state.status);
  const city = useCityStore((state) => state.city);
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
  const setVisualMode = useCityStore((state) => state.setVisualMode);
  const setQuality = useCityStore((state) => state.setQuality);
  const startCinematicTour = useCityStore((state) => state.startCinematicTour);
  const requestPhoto = useCityStore((state) => state.requestPhoto);
  const beginComparison = useCityStore((state) => state.beginComparison);
  const clearComparison = useCityStore((state) => state.clearComparison);
  const [url, setUrl] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [intelligenceOpen, setIntelligenceOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [exportState, setExportState] = useState<{ status: "idle" | "loading" | "done" | "error"; message: string }>({ status: "idle", message: "" });
  const activeCity = city ?? demoCity;
  const selectedBuilding = useMemo(
    () => activeCity.buildings.find((building) => building.id === selectedBuildingId) ?? null,
    [activeCity, selectedBuildingId],
  );
  const coreBuilding = activeCity.buildings.find((building) => building.id === activeCity.coreBuildingId);
  const searchResults = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return activeCity.buildings.slice(0, 8);
    return activeCity.buildings
      .filter((building) => building.name.toLowerCase().includes(term) || building.path.toLowerCase().includes(term))
      .sort((a, b) => Number(b.name.toLowerCase().startsWith(term)) - Number(a.name.toLowerCase().startsWith(term)))
      .slice(0, 10);
  }, [activeCity, query]);
  const relationships = useMemo(() => {
    if (!selectedBuildingId) return [];
    return activeCity.connections
      .filter((connection) => connection.sourceBuildingId === selectedBuildingId || connection.targetBuildingId === selectedBuildingId)
      .map((connection) => {
        const outgoing = connection.sourceBuildingId === selectedBuildingId;
        const otherId = outgoing ? connection.targetBuildingId : connection.sourceBuildingId;
        return { connection, outgoing, building: activeCity.buildings.find((candidate) => candidate.id === otherId) };
      })
      .filter((item) => item.building)
      .slice(0, 8);
  }, [activeCity, selectedBuildingId]);

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
        const payload = await response.json() as { error?: string };
        throw new Error(payload.error ?? "No pudimos generar el archivo.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `${activeCity.repository.name}-context.md`;
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
      setExportState({ status: "error", message: exportError instanceof Error ? exportError.message : "No pudimos exportar el contexto." });
    }
  };

  return (
    <main className={`city-app is-${status} mode-${visualMode}${selectedBuilding ? " has-inspector" : ""}`}>
      <div className="city-canvas" aria-label="Ciudad tridimensional generada desde la arquitectura de código">
        <CityScene city={activeCity} preview={status === "idle"} />
      </div>
      <div className="atmosphere" aria-hidden="true" />

      <header className="topbar">
        <button className="brand" onClick={reset} aria-label="Volver al inicio">
          <span className="brand-mark"><Building2 size={17} strokeWidth={1.8} /></span>
          <span><b>COPILOT</b> CITY</span>
        </button>
        <div className="topbar-center"><span className="live-dot" />{status === "ready" ? activeCity.repository.fullName : "URBANISMO GENERADO POR CÓDIGO"}</div>
        <a className="github-link" href="https://github.com" target="_blank" rel="noreferrer"><Github size={16} /> <span>GitHub</span></a>
      </header>

      {status === "idle" && (
        <section className="welcome-panel">
          <div className="eyebrow"><Sparkles size={13} /> EXPLORA TU ARQUITECTURA</div>
          {baselineCity && <div className="comparison-base"><GitCompareArrows size={13} /> Comparando contra <b>{baselineCity.repository.fullName}</b><button onClick={clearComparison}><X size={12} /></button></div>}
          <h1>Tu código ya es<br /><em>una ciudad.</em></h1>
          <p>Convierte cualquier repositorio público de GitHub en un mundo 3D: los archivos son edificios, las carpetas son distritos y sus dependencias trazan las calles.</p>
          <form className="repository-form" onSubmit={submit}>
            <label htmlFor="repository-url">Repositorio público de GitHub</label>
            <div className="input-shell">
              <Github size={18} />
              <input id="repository-url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="github.com/usuario/repositorio" autoComplete="url" spellCheck={false} />
              <button type="submit" aria-label="Construir ciudad" disabled={!url.trim()}><ArrowRight size={18} /></button>
            </div>
          </form>
          <button className="example-button" onClick={useExample}>O prueba con un repositorio de ejemplo <ArrowRight size={13} /></button>
          <button className="quick-export" onClick={() => void exportMarkdown(url)} disabled={!url.trim() || exportState.status === "loading"}><Download size={13} /> Sólo generar contexto .MD</button>
          <div className="visual-legend" aria-label="Cómo se representa el repositorio">
            <span><Building2 size={14} /> Archivos</span><span><Map size={14} /> Carpetas</span><span><Network size={14} /> Dependencias</span>
          </div>
          <div className="context-promise"><FileText size={16} /><span><b>Ciudad + contexto para IA</b><small>Después de explorar, descarga el repositorio como Markdown estructurado.</small></span></div>
        </section>
      )}

      {status === "loading" && (
        <section className="loading-panel" aria-live="polite">
          <div className="scanner"><span /><Code2 size={25} /></div>
          <div className="eyebrow">ANALIZANDO REPOSITORIO</div>
          <h2>Levantando la ciudad</h2>
          <p>{repositoryUrl.replace(/^https?:\/\/(www\.)?/, "")}</p>
          <div className="loading-steps"><span className="done">Leyendo estructura</span><span className="active">Trazando distritos</span><span>Construyendo edificios</span></div>
        </section>
      )}

      {status === "error" && (
        <section className="message-panel" role="alert">
          <CircleAlert size={24} />
          <div><span className="eyebrow">NO PUDIMOS CONSTRUIR LA CIUDAD</span><h2>Revisa el repositorio</h2><p>{error}</p></div>
          <button onClick={reset}>Volver a intentar</button>
        </section>
      )}

      {status === "ready" && (
        <>
          <aside className="city-summary glass-panel">
            <button className="back-button" onClick={reset}><ArrowLeft size={14} /> Otro repositorio</button>
            <button className="compare-button" onClick={beginComparison}><GitCompareArrows size={13} /> Comparar con otra ciudad</button>
            <div className="repo-heading"><span><Github size={18} /></span><div><small>{activeCity.repository.owner}</small><h2>{activeCity.repository.name}</h2></div></div>
            {activeCity.repository.description && <p>{activeCity.repository.description}</p>}
            <div className="metric-grid">
              <Metric label="edificios" value={formatNumber(activeCity.stats.files)} /><Metric label="distritos" value={activeCity.stats.districts} />
              <Metric label="conexiones" value={formatNumber(activeCity.stats.dependencies)} /><Metric label="lenguajes" value={activeCity.stats.languages} />
            </div>
            <button className="export-context-button" onClick={() => void exportMarkdown()} disabled={exportState.status === "loading"}>
              {exportState.status === "loading" ? <span className="button-spinner" /> : exportState.status === "done" ? <Check size={15} /> : <Download size={15} />}
              <span><b>{exportState.status === "loading" ? "Generando Markdown" : "Descargar contexto .MD"}</b><small>{exportState.status === "done" ? exportState.message : "Estructura + código listo para IA"}</small></span>
            </button>
            {activeCity.diagnostics.truncated && <div className="analysis-note">Vista optimizada de los archivos más relevantes del repositorio.</div>}
          </aside>

          {baselineCity && baselineCity.repository.fullName !== activeCity.repository.fullName && (
            <aside className="comparison-card glass-panel">
              <div><GitCompareArrows size={14} /> COMPARACIÓN</div>
              <b>{baselineCity.repository.name} → {activeCity.repository.name}</b>
              <span>Edificios <i>{activeCity.stats.files - baselineCity.stats.files >= 0 ? "+" : ""}{activeCity.stats.files - baselineCity.stats.files}</i></span>
              <span>Conexiones <i>{activeCity.stats.dependencies - baselineCity.stats.dependencies >= 0 ? "+" : ""}{activeCity.stats.dependencies - baselineCity.stats.dependencies}</i></span>
              <span>Distritos <i>{activeCity.stats.districts - baselineCity.stats.districts >= 0 ? "+" : ""}{activeCity.stats.districts - baselineCity.stats.districts}</i></span>
              <button onClick={clearComparison}>Cerrar comparación</button>
            </aside>
          )}

          <nav className="city-controls glass-panel" aria-label="Herramientas de exploración">
            <button className={searchOpen ? "active" : ""} onClick={() => setSearchOpen((value) => !value)}><Search size={16} /><span>Buscar</span></button>
            <button className={intelligenceOpen ? "active" : ""} onClick={() => setIntelligenceOpen((value) => !value)}><Layers3 size={16} /><span>Capas</span></button>
            <button className={viewMode === "map" ? "active" : ""} onClick={() => setViewMode("map")}><Map size={16} /><span>Mapa</span></button>
            <button id="explore-lock" className={viewMode === "explore" ? "active" : ""} onClick={() => setViewMode("explore")}><Footprints size={16} /><span>Explorar</span></button>
            {coreBuilding && <button onClick={() => focusBuilding(coreBuilding.id)}><Crown size={16} /><span>Corazón</span></button>}
          </nav>

          <nav className="scene-tools" aria-label="Dirección visual">
            <button onClick={() => setVisualMode(visualMode === "day" ? "night" : "day")} title={visualMode === "day" ? "Activar noche analítica" : "Activar luz diurna"} aria-label={visualMode === "day" ? "Activar noche analítica" : "Activar luz diurna"}>{visualMode === "day" ? <Moon size={16} /> : <Sun size={16} />}</button>
            <button onClick={startCinematicTour} title="Recorrido cinematográfico" aria-label="Iniciar recorrido cinematográfico"><Film size={16} /></button>
            <button onClick={requestPhoto} title="Guardar fotografía de la ciudad" aria-label="Guardar fotografía"><Camera size={16} /></button>
            <button onClick={() => setQuality(quality === "auto" ? "high" : quality === "high" ? "low" : "auto")} title={`Calidad: ${quality}`} aria-label={`Cambiar calidad gráfica, actual ${quality}`}><Gauge size={16} /><small>{quality === "auto" ? "A" : quality === "high" ? "H" : "L"}</small></button>
          </nav>

          {intelligenceOpen && <CityIntelligence city={activeCity} />}

          {searchOpen && (
            <section className="search-panel glass-panel">
              <div className="search-heading"><Search size={15} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar archivo o ruta…" /><button onClick={() => setSearchOpen(false)} aria-label="Cerrar búsqueda"><X size={15} /></button></div>
              <div className="search-results">
                {searchResults.map((building) => (
                  <button key={building.id} onClick={() => { focusBuilding(building.id); setSearchOpen(false); }}>
                    <span><b>{building.name}</b><small>{building.path}</small></span>
                    <LocateFixed size={14} />
                  </button>
                ))}
                {searchResults.length === 0 && <p>No encontramos un edificio con ese nombre.</p>}
              </div>
            </section>
          )}

          {selectedBuilding && (
            <aside className="inspector glass-panel">
              <button className="close-button" onClick={() => selectBuilding(null)} aria-label="Cerrar inspector"><X size={17} /></button>
              <div className="inspector-kind">{selectedBuilding.id === activeCity.coreBuildingId ? "CORAZÓN DEL SISTEMA" : selectedBuilding.variant === "landmark" ? "LANDMARK" : "EDIFICIO"}</div>
              <h2>{selectedBuilding.name}</h2><code>{selectedBuilding.path}</code>
              <div className="importance"><span>Relevancia arquitectónica</span><strong>{Math.round(selectedBuilding.importance * 100)}%</strong><div><i style={{ width: `${Math.max(5, selectedBuilding.importance * 100)}%` }} /></div></div>
              <div className="inspector-metrics">
                <Metric label="líneas" value={formatNumber(selectedBuilding.metrics.lines)} /><Metric label="complejidad" value={selectedBuilding.metrics.complexity} />
                <Metric label="dependencias" value={selectedBuilding.metrics.dependencies} /><Metric label="dependen de él" value={selectedBuilding.metrics.dependents} />
              </div>
              <div className="temporal-metrics">
                <span>Actividad reciente <b>{selectedBuilding.metrics.recentChanges} cambios</b></span>
                <span>Prioridad calculada <b>{Math.round(selectedBuilding.metrics.risk * 100)}%</b></span>
                <span>Autor principal <b>{selectedBuilding.metrics.primaryAuthor ?? "Sin datos"}</b></span>
              </div>
              <div className="building-explanation"><Code2 size={15} /><p>Este edificio tiene <b>{selectedBuilding.floors} niveles</b> por su tamaño e importancia dentro del distrito <b>{selectedBuilding.districtId}</b>.</p></div>
              <div className="inspector-actions">
                <button onClick={() => focusBuilding(selectedBuilding.id)}><LocateFixed size={14} /> Enfocar</button>
                <a href={`${activeCity.repository.htmlUrl}/blob/${activeCity.repository.defaultBranch}/${selectedBuilding.path}`} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Ver código</a>
              </div>
              {selectedBuilding.codePreview && <details className="code-preview"><summary>Vista previa del código</summary><pre><code>{selectedBuilding.codePreview}</code></pre></details>}
              <div className="relations">
                <div className="relations-title"><Route size={13} /> RELACIONES VISIBLES <span>{relationships.length}</span></div>
                {relationships.length ? relationships.map(({ connection, outgoing, building }) => building && (
                  <button key={connection.id} onClick={() => focusBuilding(building.id)}>
                    <i className={outgoing ? "outgoing" : "incoming"}>{outgoing ? "SALE" : "ENTRA"}</i>
                    <span><b>{building.name}</b><small>{building.path}</small></span>
                    <ArrowRight size={13} />
                  </button>
                )) : <p>Este archivo no tiene relaciones locales detectadas.</p>}
              </div>
            </aside>
          )}

          <div className="explore-hint">{viewMode === "map" ? <><span>Arrastra para orbitar</span><i /><span>Rueda para acercar</span><i /><span>Selecciona un edificio</span></> : <><span>Haz clic para capturar el mouse</span><i /><span>WASD para caminar</span><i /><span>Shift para correr · Esc para salir</span></>}</div>
        </>
      )}

      {status === "idle" && <div className="preview-caption"><span /> Vista previa · ciudad de demostración</div>}
      {(exportState.status === "error" || exportState.status === "done") && <div className={`export-toast ${exportState.status === "error" ? "is-error" : "is-success"}`}>{exportState.status === "error" ? <CircleAlert size={14} /> : <Check size={14} />}{exportState.message}<button onClick={() => setExportState({ status: "idle", message: "" })}><X size={13} /></button></div>}
    </main>
  );
}
