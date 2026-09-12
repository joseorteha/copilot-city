"use client";

import { FacadeSystem } from "@/components/city/building/FacadeSystem";
import { RoofKit } from "@/components/city/building/RoofKit";
import { UNIT_BOX } from "@/components/city/building/geometry";
import type { BuildingMaterials } from "@/components/city/building/materials";
import { profileFor } from "@/components/city/building/archetypes";
import type { CityBuilding } from "@/types/city";

export const PODIUM_HEIGHT = 0.38;

export function BuildingShell({ building, width, depth, height, materials }: { building: CityBuilding; width: number; depth: number; height: number; materials: BuildingMaterials }) {
  const profile = profileFor(building);
  const top = PODIUM_HEIGHT + height;
  const upperHeight = height * 0.31;
  const mainHeight = height - upperHeight * (building.variant === "tower" || building.variant === "landmark" ? 1 : 0);
  const hasSetback = building.variant === "tower" || building.variant === "landmark";

  return <>
    <mesh geometry={UNIT_BOX} position={[0, PODIUM_HEIGHT / 2, 0]} scale={[building.width * 1.22, PODIUM_HEIGHT, building.depth * 1.22]} castShadow receiveShadow material={materials.base} />
    <mesh geometry={UNIT_BOX} position={[0, PODIUM_HEIGHT + mainHeight / 2, 0]} scale={[width, mainHeight, depth]} castShadow receiveShadow material={materials.facade} />
    <FacadeSystem width={width} depth={depth} height={mainHeight} floors={building.floors} density={profile.windowDensity} seed={building.path} materials={materials} />

    {hasSetback && <group position={[0, PODIUM_HEIGHT + mainHeight, 0]}>
      <mesh geometry={UNIT_BOX} position={[0, upperHeight / 2, 0]} scale={[width * profile.taper, upperHeight, depth * profile.taper]} castShadow receiveShadow material={materials.facade} />
      <FacadeSystem width={width * profile.taper} depth={depth * profile.taper} height={upperHeight} floors={Math.max(2, Math.ceil(building.floors * 0.3))} density={profile.windowDensity} seed={`${building.path}:upper`} materials={materials} />
    </group>}

    {profile.wings && [-1, 1].map((side) => <mesh key={side} geometry={UNIT_BOX} position={[side * width * 0.57, PODIUM_HEIGHT + height * 0.28, 0]} scale={[width * 0.22, height * 0.43, depth * 0.78]} castShadow receiveShadow material={materials.facade} />)}
    {profile.fins && [-1, 1].flatMap((x) => [-1, 1].map((z) => <mesh key={`${x}:${z}`} geometry={UNIT_BOX} position={[x * (width / 2 + 0.035), PODIUM_HEIGHT + mainHeight / 2, z * (depth / 2 + 0.035)]} scale={[0.075, mainHeight, 0.075]} castShadow material={materials.accent} />))}

    <mesh geometry={UNIT_BOX} position={[0, 0.58, depth / 2 + 0.055]} scale={[Math.min(1.15, width * 0.45), 0.78, 0.07]} material={materials.glass} />
    <mesh geometry={UNIT_BOX} position={[0, 1.02, depth / 2 + 0.3]} scale={[Math.min(1.55, width * 0.65), 0.075, 0.54]} castShadow material={materials.accent} />
    <RoofKit profile={profile} top={top} width={hasSetback ? width * profile.taper : width} depth={hasSetback ? depth * profile.taper : depth} materials={materials} />
  </>;
}
