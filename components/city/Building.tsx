"use client";

import { Detailed, Html } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { Group } from "three";

import { PODIUM_HEIGHT, assembleBuilding } from "@/components/city/building/assemble";
import { SemanticFx } from "@/components/city/building/SemanticFx";
import { buildingMaterials, materialsFor } from "@/components/city/building/materials";
import { taperedUnit } from "./building/geometry";
import { useBuildingState, useCityStore } from "@/store/city-store";
import type { CityBuilding } from "@/types/city";

export function Building({ building, order }: { building: CityBuilding; order: number }) {
  const selected = useCityStore((state) => state.selectedBuildingId === building.id);
  const focusBuilding = useCityStore((state) => state.focusBuilding);
  const layer = useCityStore((state) => state.layer);
  const visualMode = useCityStore((state) => state.visualMode);
  const viewMode = useCityStore((state) => state.viewMode);
  const quality = useCityStore((state) => state.quality);
  // One derived record per building, computed once when the city loads: dragging the
  // timeline used to re-sort the commit list inside every building on every frame.
  const derived = useBuildingState(building.id);
  const [hovered, setHovered] = useState(false);
  const group = useRef<Group>(null);
  const reveal = useRef(-0.6 - Math.min(order, 150) * 0.012);

  const active = selected || hovered;
  const inCycle = (layer === "dependencies" || layer === "risk") && derived.inCycle;
  const recentRepair = layer === "activity" && derived.recentRepair;
  const pullStatus = derived.pullStatus;
  const override = pullStatus
    ? pullStatus === "removed"
      ? "#c65048"
      : pullStatus === "added"
        ? "#73ba82"
        : "#e1b657"
    : null;

  const { width, depth, height } = building;
  const levels = useMemo(
    () => assembleBuilding(building, width, depth, height),
    [building, width, depth, height],
  );
  const materials = useMemo(
    () => buildingMaterials(building, active, layer, override, visualMode === "night"),
    [active, building, layer, override, visualMode],
  );
  const top = PODIUM_HEIGHT + height;

  useEffect(
    () => () => {
      levels.near?.geometry.dispose();
      levels.far?.geometry.dispose();
    },
    [levels],
  );

  useFrame((_, delta) => {
    if (!group.current) return;
    reveal.current = Math.min(1, reveal.current + delta * 1.45);
    const progress = Math.max(0.001, reveal.current);
    const layerScale =
      layer === "complexity"
        ? 1 + Math.min(1, building.metrics.complexity / 60) * 0.65
        : layer === "core" && building.centrality < 0.25
          ? 0.55
          : layer === "tests" && building.variant !== "laboratory"
            ? 0.7
            : 1;
    const targetScale = (1 - Math.pow(1 - progress, 3)) * layerScale;
    if (reveal.current >= 1 && Math.abs(group.current.scale.y - targetScale) < 0.001) return;
    group.current.scale.y += (targetScale - group.current.scale.y) * Math.min(1, delta * 8);
  });

  const stop = (event: ThreeEvent<MouseEvent | PointerEvent>) => event.stopPropagation();

  return (
    <group
      ref={group}
      position={building.position}
      rotation={[0, building.rotation, 0]}
      scale={[1, 0.001, 1]}
      visible={derived.existsAtTime}
      onClick={(event) => {
        stop(event);
        focusBuilding(building.id);
      }}
      onPointerOver={(event) => {
        stop(event);
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={(event) => {
        stop(event);
        setHovered(false);
        document.body.style.cursor = "";
      }}
    >
      <Detailed
        distances={selected ? [0, 18, 48] : viewMode === "explore" ? [0, 8, 34] : [0, 5, 34]}
        hysteresis={0.24}
      >
        {levels.near ? (
          <mesh
            geometry={levels.near.geometry}
            material={materialsFor(levels.near.kinds, materials)}
            castShadow={quality === "high" || building.importance > 0.24}
            receiveShadow
          />
        ) : (
          <group />
        )}
        {levels.far ? (
          <mesh
            geometry={levels.far.geometry}
            material={materials.overview}
            castShadow={quality === "high" || building.isLandmark}
            receiveShadow
          />
        ) : (
          <group />
        )}
        <mesh
          geometry={taperedUnit(0.86)}
          position={[0, height * 0.5 + PODIUM_HEIGHT, 0]}
          scale={[width, height, depth]}
          material={materials.overview}
          castShadow={quality === "high" || building.isLandmark}
        />
      </Detailed>
      {(selected || pullStatus || inCycle || recentRepair) && (
        <SemanticFx
          selected={selected}
          pullStatus={pullStatus}
          inCycle={inCycle}
          recentRepair={recentRepair}
          width={width}
          depth={depth}
          height={height}
          top={top}
          materials={materials}
        />
      )}
      {hovered && !selected && (
        <Html center position={[0, top + 1.25, 0]} distanceFactor={14} className="building-tooltip-anchor">
          <div className="building-tooltip">
            <strong>{building.name}</strong>
            <span>
              {building.metrics.language} · {building.metrics.lines.toLocaleString("es-ES")} líneas
            </span>
          </div>
        </Html>
      )}
    </group>
  );
}
