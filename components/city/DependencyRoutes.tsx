"use client";

import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Mesh } from "three";

import { useCityStore } from "@/store/city-store";
import type { CityConnection } from "@/types/city";

function Route({ connection, outgoing, order }: { connection: CityConnection; outgoing: boolean; order: number }) {
  const pulse = useRef<Mesh>(null);
  const start = connection.source;
  const end = connection.target;
  const height = connection.crossDistrict ? 0.78 : 0.55;

  useFrame(({ clock }) => {
    if (!pulse.current) return;
    const progress = (clock.elapsedTime * .22 + order * .19) % 1;
    pulse.current.position.set(
      start[0] + (end[0] - start[0]) * progress,
      height + Math.sin(progress * Math.PI) * .55,
      start[1] + (end[1] - start[1]) * progress,
    );
  });

  const color = outgoing ? "#e3c77e" : "#9fc4b3";
  return (
    <group>
      <Line
        points={[[start[0], height, start[1]], [(start[0] + end[0]) / 2, height + .55, (start[1] + end[1]) / 2], [end[0], height, end[1]]]}
        color={color}
        lineWidth={connection.crossDistrict ? 2.2 : 1.5}
        transparent
        opacity={.78}
        dashed
        dashScale={4}
        dashSize={.35}
        gapSize={.22}
      />
      <mesh ref={pulse}><sphereGeometry args={[.1, 10, 8]} /><meshBasicMaterial color={color} /></mesh>
    </group>
  );
}

export function DependencyRoutes({ connections }: { connections: CityConnection[] }) {
  const selectedId = useCityStore((state) => state.selectedBuildingId);
  if (!selectedId) return null;
  const visible = connections.filter((connection) => connection.sourceBuildingId === selectedId || connection.targetBuildingId === selectedId).slice(0, 24);
  return <group>{visible.map((connection, index) => <Route key={connection.id} connection={connection} outgoing={connection.sourceBuildingId === selectedId} order={index} />)}</group>;
}
