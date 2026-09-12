"use client";

import { Edges, Html, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Color, Group } from "three";

import type { CityDistrict } from "@/types/city";

function DistrictTree({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0.28, z]}>
      <mesh position={[0, 0.46, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.085, 0.92, 7]} />
        <meshStandardMaterial color="#5d5145" roughness={1} />
      </mesh>
      <mesh position={[0, 1.08, 0]} castShadow>
        <icosahedronGeometry args={[0.42, 1]} />
        <meshStandardMaterial color="#486051" roughness={0.98} />
      </mesh>
    </group>
  );
}

export function District({ district, order }: { district: CityDistrict; order: number }) {
  const group = useRef<Group>(null);
  const reveal = useRef(-order * .07);
  const surface = new Color(district.color).multiplyScalar(0.82).getStyle();
  const cornerX = district.size[0] / 2 - 0.75;
  const cornerZ = district.size[1] / 2 - 0.75;

  useFrame((_, delta) => {
    if (!group.current || reveal.current >= 1) return;
    reveal.current = Math.min(1, reveal.current + delta * 1.5);
    const scale = Math.max(.001, 1 - Math.pow(1 - Math.max(0, reveal.current), 3));
    group.current.scale.set(scale, scale, scale);
  });

  return (
    <group ref={group} scale={.001} position={[district.position[0], 0, district.position[1]]}>
      <RoundedBox args={[district.size[0], 0.34, district.size[1]]} radius={0.34} smoothness={3} position={[0, 0.17, 0]} receiveShadow>
        <meshStandardMaterial color={surface} roughness={0.95} />
        <Edges color={district.color} threshold={24} />
      </RoundedBox>

      <mesh position={[0, 0.355, 0]} receiveShadow>
        <boxGeometry args={[Math.max(2, district.size[0] - 1.05), 0.025, Math.max(2, district.size[1] - 1.05)]} />
        <meshStandardMaterial color="#777b73" roughness={0.98} />
      </mesh>

      <DistrictTree x={-cornerX} z={-cornerZ} />
      <DistrictTree x={cornerX} z={cornerZ} />

      <Html center position={[0, 0.72, -district.size[1] / 2 + 0.42]} distanceFactor={18} className="district-label-anchor">
        <div className="district-label">
          <span style={{ backgroundColor: district.color }} />
          {district.name}
          <small>{district.purpose} · {district.buildingCount}</small>
        </div>
      </Html>
    </group>
  );
}
