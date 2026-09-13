"use client";
import { Line } from "@react-three/drei";
import { useMemo } from "react";
import { useCityStore } from "@/store/city-store";
import type { CityConnection } from "@/types/city";

export function DependencyRoutes({ connections }: { connections: CityConnection[] }) {
  const selected = useCityStore((state) => state.selectedBuildingId);
  const layer = useCityStore((state) => state.layer);
  const city = useCityStore((state) => state.city);
  const visible = useMemo(() => {
    const important = new Set(city.buildings.filter((b) => b.centrality >= 0.3).map((b) => b.id));
    return connections
      .filter((c) =>
        selected
          ? c.sourceBuildingId === selected || c.targetBuildingId === selected
          : layer === "core"
            ? important.has(c.targetBuildingId)
            : layer === "dependencies",
      )
      .slice(0, 32);
  }, [connections, selected, layer, city]);
  return (
    <group>
      {visible.map((c) => (
        <Line
          key={c.id}
          points={c.route.map(([x, z]) => [x, 0.64, z])}
          color={c.sourceBuildingId === selected ? "#aa702a" : "#346d77"}
          lineWidth={2.5}
          transparent
          opacity={0.88}
        />
      ))}
    </group>
  );
}
