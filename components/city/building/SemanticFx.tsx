"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Group, MeshStandardMaterial } from "three";

import { UNIT_BOX } from "@/components/city/building/geometry";
import type { BuildingMaterials } from "@/components/city/building/materials";

export function SemanticFx({ selected, pullStatus, inCycle, recentRepair, width, depth, height, top, materials }: {
  selected: boolean; pullStatus: string | null; inCycle: boolean; recentRepair: boolean;
  width: number; depth: number; height: number; top: number; materials: BuildingMaterials;
}) {
  const scanner = useRef<Group>(null);
  const crane = useRef<Group>(null);
  const scanMaterial = useRef<MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (scanner.current && selected) {
      const progress = (clock.elapsedTime * 0.24) % 1;
      scanner.current.position.y = 0.25 + progress * (height + 0.8);
      if (scanMaterial.current) scanMaterial.current.opacity = 0.18 + Math.sin(progress * Math.PI) * 0.42;
    }
    if (crane.current) crane.current.rotation.y = clock.elapsedTime * 0.12;
  });

  return <>
    {selected && <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}><ringGeometry args={[Math.max(width, depth) * 0.7, Math.max(width, depth) * 0.86, 48]} /><meshBasicMaterial color="#f0ca78" transparent opacity={0.94} depthWrite={false} /></mesh>
      <group ref={scanner}>
        <mesh geometry={UNIT_BOX} scale={[width * 1.15, 0.045, depth * 1.15]}>
          <meshStandardMaterial ref={scanMaterial} color="#7de0d1" emissive="#53cfbd" emissiveIntensity={2.4} transparent opacity={0.5} depthWrite={false} />
        </mesh>
      </group>
    </>}
    {pullStatus && <group>
      {[-1, 1].map((side) => <mesh key={side} geometry={UNIT_BOX} position={[side * (width / 2 + 0.2), height * 0.48, 0]} scale={[0.055, height * 0.86, depth * 1.18]} material={materials.accent} />)}
      {[0.25, 0.5, 0.75].map((ratio) => <mesh key={ratio} geometry={UNIT_BOX} position={[0, height * ratio, depth / 2 + 0.2]} scale={[width * 1.25, 0.055, 0.055]} material={materials.accent} />)}
      <group position={[width * 0.62, 0, -depth * 0.46]}>
        <mesh geometry={UNIT_BOX} position={[0, height * 0.58, 0]} scale={[0.075, height * 1.15, 0.075]} material={materials.accent} />
        <group ref={crane} position={[0, height * 1.12, 0]}>
          <mesh geometry={UNIT_BOX} position={[width * 0.22, 0, 0]} scale={[width * 0.68, 0.065, 0.065]} material={materials.windowLight} />
          <mesh geometry={UNIT_BOX} position={[width * 0.48, -0.34, 0]} scale={[0.025, 0.68, 0.025]} material={materials.accent} />
        </group>
      </group>
    </group>}
    {inCycle && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}><ringGeometry args={[Math.max(width, depth) * 0.88, Math.max(width, depth) * 1.02, 42]} /><meshBasicMaterial color="#ee815b" transparent opacity={0.88} depthWrite={false} /></mesh>}
    {recentRepair && <group position={[0, top + 0.62, 0]}><mesh><sphereGeometry args={[0.13, 12, 10]} /><meshStandardMaterial color="#ffc66a" emissive="#ed7431" emissiveIntensity={2.2} /></mesh><pointLight color="#e9a052" intensity={1.1} distance={3.5} /></group>}
  </>;
}
