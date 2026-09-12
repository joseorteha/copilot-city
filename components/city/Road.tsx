"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Group } from "three";

import type { CityRoad } from "@/types/city";

export function Road({ road, order }: { road: CityRoad; order: number }) {
  const group = useRef<Group>(null);
  const reveal = useRef(-.16 - order * .018);
  const geometry = useMemo(() => {
    const deltaX = road.to[0] - road.from[0];
    const deltaZ = road.to[1] - road.from[1];
    return {
      length: Math.hypot(deltaX, deltaZ),
      angle: Math.atan2(deltaX, deltaZ),
      center: [(road.from[0] + road.to[0]) / 2, (road.from[1] + road.to[1]) / 2] as const,
    };
  }, [road]);
  const isBridge = road.kind === "bridge" || road.kind === "avenue";
  const markings = Math.max(1, Math.floor(geometry.length / 2.4));

  useFrame((_, delta) => {
    if (!group.current || reveal.current >= 1) return;
    reveal.current = Math.min(1, reveal.current + delta * 1.65);
    group.current.scale.z = Math.max(.001, 1 - Math.pow(1 - Math.max(0, reveal.current), 3));
  });

  return (
    <group ref={group} scale={[1, 1, .001]} position={[geometry.center[0], 0.26, geometry.center[1]]} rotation={[0, geometry.angle, 0]}>
      <mesh receiveShadow castShadow={isBridge}>
        <boxGeometry args={[road.width, isBridge ? 0.2 : 0.1, geometry.length]} />
        <meshStandardMaterial color={road.kind === "avenue" ? "#3d4443" : "#353d3e"} roughness={0.92} />
      </mesh>
      <mesh position={[-road.width / 2 - 0.09, 0.08, 0]}>
        <boxGeometry args={[0.18, 0.13, geometry.length]} />
        <meshStandardMaterial color="#7d8179" roughness={0.9} />
      </mesh>
      <mesh position={[road.width / 2 + 0.09, 0.08, 0]}>
        <boxGeometry args={[0.18, 0.13, geometry.length]} />
        <meshStandardMaterial color="#7d8179" roughness={0.9} />
      </mesh>

      {Array.from({ length: markings }, (_, index) => {
        const spacing = geometry.length / markings;
        return (
          <mesh key={index} position={[0, 0.115, -geometry.length / 2 + spacing * (index + 0.5)]}>
            <boxGeometry args={[0.045, 0.018, Math.min(0.76, spacing * 0.44)]} />
            <meshStandardMaterial color="#c2b477" roughness={0.8} />
          </mesh>
        );
      })}

      {isBridge && Array.from({ length: Math.max(1, Math.floor(geometry.length / 5)) }, (_, index) => (
        <mesh key={`support-${index}`} position={[0, -0.34, -geometry.length / 2 + ((index + 0.5) / Math.max(1, Math.floor(geometry.length / 5))) * geometry.length]} castShadow>
          <boxGeometry args={[road.width * 0.72, 0.7, 0.22]} />
          <meshStandardMaterial color="#555f5c" roughness={0.88} />
        </mesh>
      ))}
    </group>
  );
}
