"use client";

import { UNIT_BOX, UNIT_CYLINDER_8, UNIT_CYLINDER_16 } from "@/components/city/building/geometry";
import type { BuildingMaterials } from "@/components/city/building/materials";
import type { BuildingProfile } from "@/components/city/building/archetypes";

export function RoofKit({ profile, top, width, depth, materials }: { profile: BuildingProfile; top: number; width: number; depth: number; materials: BuildingMaterials }) {
  return (
    <group>
      <mesh geometry={UNIT_BOX} position={[0, top + 0.1, 0]} scale={[width * 0.94, 0.2, depth * 0.94]} castShadow material={materials.roof} />
      {profile.crown === "spire" && <>
        <mesh geometry={UNIT_CYLINDER_8} position={[0, top + 0.46, 0]} scale={[width * 0.15, 0.52, width * 0.15]} castShadow material={materials.accent} />
        <mesh geometry={UNIT_CYLINDER_8} position={[0, top + 1.08, 0]} scale={[0.035, 0.74, 0.035]} material={materials.windowLight} />
      </>}
      {profile.crown === "vents" && [-0.28, 0, 0.28].map((offset) => <mesh key={offset} geometry={UNIT_CYLINDER_8} position={[width * offset, top + 0.4, 0]} scale={[0.12, 0.58, 0.12]} castShadow material={materials.roof} />)}
      {profile.crown === "dome" && <mesh geometry={UNIT_CYLINDER_16} position={[0, top + 0.34, 0]} scale={[Math.min(width, depth) * 0.28, 0.5, Math.min(width, depth) * 0.28]} castShadow material={materials.glass} />}
      {profile.crown === "terrace" && <>
        <mesh geometry={UNIT_BOX} position={[0, top + 0.26, 0]} scale={[width * 0.62, 0.32, depth * 0.66]} castShadow material={materials.facade} />
        <mesh geometry={UNIT_BOX} position={[0, top + 0.46, 0]} scale={[width * 0.7, 0.06, depth * 0.74]} material={materials.accent} />
      </>}
      {profile.crown === "library" && <mesh geometry={UNIT_BOX} position={[0, top + 0.28, 0]} scale={[width * 0.72, 0.34, depth * 0.72]} castShadow material={materials.glass} />}
    </group>
  );
}
