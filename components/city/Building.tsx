"use client";

import { Html } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { Group } from "three";

import { BuildingShell, PODIUM_HEIGHT } from "@/components/city/building/BuildingShell";
import { SemanticFx } from "@/components/city/building/SemanticFx";
import { createBuildingMaterials } from "@/components/city/building/materials";
import { useCityStore } from "@/store/city-store";
import type { CityBuilding } from "@/types/city";

export function Building({ building, order }: { building: CityBuilding; order: number }) {
  const selected = useCityStore((state) => state.selectedBuildingId === building.id);
  const selectBuilding = useCityStore((state) => state.selectBuilding);
  const city = useCityStore((state) => state.city);
  const layer = useCityStore((state) => state.layer);
  const activePullRequest = useCityStore((state) => state.activePullRequest);
  const timelineIndex = useCityStore((state) => state.timelineIndex);
  const visualMode = useCityStore((state) => state.visualMode);
  const [hovered, setHovered] = useState(false);
  const group = useRef<Group>(null);
  const reveal = useRef(-order * 0.012);
  const active = selected || hovered;
  const pullRequest = city?.insights.pullRequests.find((pull) => pull.number === activePullRequest);
  const pullChange = pullRequest?.files.find((file) => file.path === building.path);
  const inCycle = (layer === "dependencies" || layer === "risk") && (city?.cycles.some((cycle) => cycle.includes(building.id)) ?? false);
  const recentRepair = layer === "activity" && (city?.insights.commits.some((commit) => /\b(fix|bug|repair|patch)\b/i.test(commit.message) && commit.files.some((file) => file.path === building.path)) ?? false);
  const commits = useMemo(() => [...(city?.insights.commits ?? [])].sort((a, b) => a.date.localeCompare(b.date)), [city?.insights.commits]);
  const threshold = commits[Math.min(commits.length - 1, Math.floor((timelineIndex / 100) * commits.length))]?.date;
  const existsAtTime = !threshold || !building.metrics.introducedAt || building.metrics.introducedAt <= threshold;
  const override = pullChange ? pullChange.status === "removed" ? "#c65048" : pullChange.status === "added" ? "#73ba82" : "#e1b657" : null;
  const materials = useMemo(() => createBuildingMaterials(building, active, layer, override, visualMode === "night"), [active, building, layer, override, visualMode]);
  const isWide = building.variant === "industrial" || building.variant === "library";
  const width = building.variant === "tower" ? building.width * 0.82 : isWide ? building.width * 1.18 : building.width;
  const depth = building.variant === "tower" ? building.depth * 0.84 : isWide ? building.depth * 1.08 : building.depth;
  const height = building.variant === "industrial" ? Math.max(2.4, building.height * 0.63) : building.height;
  const top = PODIUM_HEIGHT + height;

  useEffect(() => () => Object.values(materials).forEach((material) => material.dispose()), [materials]);

  useFrame((_, delta) => {
    if (!group.current || reveal.current >= 1) return;
    reveal.current = Math.min(1, reveal.current + delta * 1.45);
    const progress = Math.max(0.001, reveal.current);
    group.current.scale.y = 1 - Math.pow(1 - progress, 3);
  });

  const stop = (event: ThreeEvent<MouseEvent | PointerEvent>) => event.stopPropagation();

  return <group
    ref={group}
    position={building.position}
    rotation={[0, building.rotation, 0]}
    scale={[1, 0.001, 1]}
    visible={existsAtTime}
    onClick={(event) => { stop(event); selectBuilding(building.id); }}
    onPointerOver={(event) => { stop(event); setHovered(true); document.body.style.cursor = "pointer"; }}
    onPointerOut={(event) => { stop(event); setHovered(false); document.body.style.cursor = ""; }}
  >
    <BuildingShell building={building} width={width} depth={depth} height={height} materials={materials} />
    <SemanticFx selected={selected} pullStatus={pullChange?.status ?? null} inCycle={inCycle} recentRepair={recentRepair} width={width} depth={depth} height={height} top={top} materials={materials} />
    {hovered && !selected && <Html center position={[0, top + 1.25, 0]} distanceFactor={14} className="building-tooltip-anchor">
      <div className="building-tooltip"><strong>{building.name}</strong><span>{building.metrics.language} · {building.metrics.lines.toLocaleString("es-ES")} líneas</span></div>
    </Html>}
  </group>;
}
