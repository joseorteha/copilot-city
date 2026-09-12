"use client";

import { Html } from "@react-three/drei";

import type { CityDistrict } from "@/types/city";

function Tree({ angle, radius }: { angle: number; radius: number }) {
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  return (
    <group position={[x, 0.46, z]}>
      <mesh castShadow position={[0, 0.22, 0]}><cylinderGeometry args={[0.04, 0.06, 0.44, 7]} /><meshStandardMaterial color="#574c40" roughness={1} /></mesh>
      <mesh castShadow position={[0, 0.62, 0]}><icosahedronGeometry args={[0.29, 1]} /><meshStandardMaterial color="#405b4a" roughness={1} /></mesh>
    </group>
  );
}

export function Plaza({ district, isCore }: { district: CityDistrict; isCore: boolean }) {
  const [x, z] = district.plazaPosition;
  return (
    <group position={[x, 0.39, z]}>
      <mesh receiveShadow position={[0, 0.035, 0]}>
        <cylinderGeometry args={[1.35, 1.35, 0.07, 32]} />
        <meshStandardMaterial color={isCore ? "#a6956d" : "#85877e"} roughness={0.96} />
      </mesh>
      <mesh receiveShadow position={[0, 0.077, 0]}>
        <ringGeometry args={[0.72, 1.03, 32]} /><meshStandardMaterial color="#b4aa91" roughness={.9} />
      </mesh>
      <mesh castShadow position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.22, 0.28, 0.42, 12]} /><meshStandardMaterial color="#6b706b" roughness={.86} />
      </mesh>
      {isCore && <mesh castShadow position={[0, 0.79, 0]}><octahedronGeometry args={[0.27]} /><meshStandardMaterial color="#d7bd7b" metalness={.3} roughness={.38} emissive="#6f5b2d" emissiveIntensity={.18} /></mesh>}
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle) => <Tree key={angle} angle={angle + Math.PI / 4} radius={1.08} />)}
      {isCore && <Html center position={[0, 1.55, 0]} distanceFactor={18} className="district-label-anchor"><div className="core-label"><span /> NÚCLEO ARQUITECTÓNICO</div></Html>}
    </group>
  );
}
