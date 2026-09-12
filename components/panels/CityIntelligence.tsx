"use client";

import { Activity, Boxes, BrainCircuit, CheckCircle2, CloudRain, GitCommitHorizontal, GitPullRequest, Network, ShieldAlert, Users } from "lucide-react";

import { useCityStore } from "@/store/city-store";
import type { CityLayer, CityModel } from "@/types/city";

const layers: Array<{ id: CityLayer; label: string; icon: typeof Boxes }> = [
  { id: "structure", label: "Estructura", icon: Boxes },
  { id: "complexity", label: "Complejidad", icon: BrainCircuit },
  { id: "activity", label: "Actividad", icon: Activity },
  { id: "dependencies", label: "Conexiones", icon: Network },
  { id: "risk", label: "Prioridad", icon: ShieldAlert },
  { id: "ownership", label: "Autoría", icon: Users },
];

export function CityIntelligence({ city }: { city: CityModel }) {
  const layer = useCityStore((state) => state.layer);
  const timelineIndex = useCityStore((state) => state.timelineIndex);
  const activePullRequest = useCityStore((state) => state.activePullRequest);
  const setLayer = useCityStore((state) => state.setLayer);
  const setTimelineIndex = useCityStore((state) => state.setTimelineIndex);
  const setActivePullRequest = useCityStore((state) => state.setActivePullRequest);
  const focusBuilding = useCityStore((state) => state.focusBuilding);
  const commits = [...city.insights.commits].sort((a, b) => a.date.localeCompare(b.date));
  const currentCommit = commits[Math.min(commits.length - 1, Math.floor((timelineIndex / 100) * commits.length))];
  const riskiest = [...city.buildings].sort((a, b) => b.metrics.risk - a.metrics.risk)[0];
  const mostActive = [...city.buildings].sort((a, b) => b.metrics.recentChanges - a.metrics.recentChanges)[0];

  return (
    <aside className="intelligence-panel glass-panel">
      <div className="panel-kicker">CAPAS DE INTELIGENCIA</div>
      <div className="layer-grid">
        {layers.map(({ id, label, icon: Icon }) => <button key={id} className={layer === id ? "active" : ""} onClick={() => setLayer(id)}><Icon size={14} /><span>{label}</span></button>)}
      </div>

      <section className="timeline-section">
        <div className="panel-title"><GitCommitHorizontal size={13} /> TIEMPO GIT <span>{commits.length ? `${currentCommit?.sha.slice(0, 7) ?? "actual"}` : "sin historial"}</span></div>
        <input type="range" min="0" max="100" value={timelineIndex} disabled={!commits.length} onChange={(event) => setTimelineIndex(Number(event.target.value))} />
        <div className="timeline-labels"><span>{commits.at(0) ? new Date(commits[0].date).toLocaleDateString("es-MX", { month: "short", day: "numeric" }) : "—"}</span><b>{currentCommit?.message ?? "El historial no está disponible"}</b><span>Ahora</span></div>
      </section>

      <section>
        <div className="panel-title"><GitPullRequest size={13} /> OBRAS · PULL REQUESTS <span>{city.insights.pullRequests.length}</span></div>
        <div className="pull-list">
          {city.insights.pullRequests.map((pull) => <button key={pull.number} className={activePullRequest === pull.number ? "active" : ""} onClick={() => setActivePullRequest(activePullRequest === pull.number ? null : pull.number)}><i>#{pull.number}</i><span><b>{pull.title}</b><small>{pull.changedFiles} edificios · +{pull.additions} −{pull.deletions}</small></span></button>)}
          {!city.insights.pullRequests.length && <p>No hay Pull Requests abiertas visibles.</p>}
        </div>
      </section>

      <section>
        <div className="panel-title"><Activity size={13} /> RECORRIDOS RECOMENDADOS</div>
        <div className="tour-list">
          <button onClick={() => focusBuilding(city.coreBuildingId)}><span>01</span><b>Corazón del sistema</b></button>
          {riskiest && <button onClick={() => focusBuilding(riskiest.id)}><span>02</span><b>Prioridad de revisión</b></button>}
          {mostActive && mostActive.metrics.recentChanges > 0 && <button onClick={() => focusBuilding(mostActive.id)}><span>03</span><b>Actividad reciente</b></button>}
          {city.cycles[0]?.[0] && <button onClick={() => focusBuilding(city.cycles[0][0])}><span>04</span><b>Ciclo principal ({city.cycles[0].length})</b></button>}
        </div>
      </section>

      {!!city.insights.contributors.length && <section><div className="panel-title"><Users size={13} /> HABITANTES PRINCIPALES</div><div className="contributors">{city.insights.contributors.slice(0, 6).map((person) => <a key={person.login} href={person.htmlUrl} target="_blank" rel="noreferrer" title={`${person.login}: ${person.contributions} contribuciones`}><span>{person.login.slice(0, 2).toUpperCase()}</span><small>{person.login}</small></a>)}</div></section>}
      {city.insights.ci && <section><a className={`ci-status is-${city.insights.ci.conclusion ?? city.insights.ci.status}`} href={city.insights.ci.htmlUrl} target="_blank" rel="noreferrer">{city.insights.ci.conclusion === "success" ? <CheckCircle2 size={14} /> : <CloudRain size={14} />}<span><b>{city.insights.ci.name}</b><small>CI: {city.insights.ci.conclusion ?? city.insights.ci.status}</small></span></a></section>}
    </aside>
  );
}
