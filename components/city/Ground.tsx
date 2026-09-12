"use client";

import { RoundedBox } from "@react-three/drei";

import { useCityStore } from "@/store/city-store";
import type { CityBounds } from "@/types/city";

export function Ground({ bounds }: { bounds: CityBounds }) {
  const visualMode = useCityStore((state) => state.visualMode);
  const width = Math.max(34, bounds.width);
  const depth = Math.max(30, bounds.depth);
  const night = visualMode === "night";

  return <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.9, 0]} receiveShadow>
      <planeGeometry args={[width + 180, depth + 180]} />
      <meshStandardMaterial color={night ? "#071312" : "#263c34"} roughness={0.92} metalness={0.02} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.82, 0]}>
      <ringGeometry args={[Math.max(width, depth) * 0.7, Math.max(width, depth) * 1.8, 96]} />
      <meshPhysicalMaterial color={night ? "#102e32" : "#496d6b"} roughness={0.2} metalness={0.12} clearcoat={0.7} clearcoatRoughness={0.28} transparent opacity={0.72} />
    </mesh>
    <RoundedBox args={[width + 1.8, 0.84, depth + 1.8]} radius={1.15} smoothness={6} position={[0, -0.45, 0]} receiveShadow castShadow>
      <meshStandardMaterial color={night ? "#172120" : "#313d3a"} roughness={0.82} metalness={0.06} />
    </RoundedBox>
    <RoundedBox args={[width, 0.16, depth]} radius={0.72} smoothness={5} position={[0, 0.02, 0]} receiveShadow>
      <meshStandardMaterial color={night ? "#26332f" : "#53605a"} roughness={0.94} />
    </RoundedBox>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.115, 0]}>
      <ringGeometry args={[Math.max(width, depth) * 0.485, Math.max(width, depth) * 0.492, 96]} />
      <meshBasicMaterial color={night ? "#599f99" : "#b9aa7a"} transparent opacity={0.38} />
    </mesh>
  </group>;
}
