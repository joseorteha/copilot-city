"use client";

import { Crosshair, X } from "lucide-react";
import { useMemo } from "react";

import { useCityStore } from "@/store/city-store";
import type { CityModel } from "@/types/city";

export function CityMinimap({ city, onClose }: { city: CityModel; onClose: () => void }) {
  const selectedBuildingId = useCityStore((state) => state.selectedBuildingId);
  const focusBuilding = useCityStore((state) => state.focusBuilding);
  const frame = useMemo(() => {
    const padding = Math.max(5, city.bounds.radius * 0.08);
    return {
      x: -city.bounds.width / 2 - padding,
      y: -city.bounds.depth / 2 - padding,
      width: city.bounds.width + padding * 2,
      height: city.bounds.depth + padding * 2,
    };
  }, [city.bounds]);

  const focusDistrict = (districtId: string) => {
    const target = city.buildings
      .filter((building) => building.districtId === districtId)
      .sort((a, b) => b.importance - a.importance)[0];
    if (target) focusBuilding(target.id);
  };

  return (
    <aside className="city-minimap glass-panel" aria-label="Minimapa de la ciudad">
      <div className="minimap-heading">
        <span>
          <Crosshair size={12} /> MINIMAPA
        </span>
        <button onClick={onClose} aria-label="Cerrar minimapa">
          <X size={12} />
        </button>
      </div>
      <svg
        viewBox={`${frame.x} ${frame.y} ${frame.width} ${frame.height}`}
        role="img"
        aria-label={`${city.stats.districts} distritos y ${city.stats.files} edificios`}
      >
        <g className="minimap-districts">
          {city.districts.map((district) => (
            <rect
              key={district.id}
              x={district.position[0] - district.size[0] / 2}
              y={district.position[1] - district.size[1] / 2}
              width={district.size[0]}
              height={district.size[1]}
              rx={0.65}
              fill={district.color}
              onClick={() => focusDistrict(district.id)}
            >
              <title>
                {district.name} · {district.buildingCount} edificios
              </title>
            </rect>
          ))}
        </g>
        <g className="minimap-roads">
          {city.roads.map((road) => (
            <line
              key={road.id}
              x1={road.from[0]}
              y1={road.from[1]}
              x2={road.to[0]}
              y2={road.to[1]}
              strokeWidth={Math.max(0.22, road.width * 0.2)}
            />
          ))}
        </g>
        <g className="minimap-buildings">
          {city.buildings.map((building) => {
            const selected = building.id === selectedBuildingId;
            const core = building.id === city.coreBuildingId;
            return (
              <circle
                key={building.id}
                cx={building.position[0]}
                cy={building.position[2]}
                r={selected ? 0.82 : core ? 0.64 : 0.24}
                className={selected ? "is-selected" : core ? "is-core" : undefined}
              >
                <title>{building.path}</title>
              </circle>
            );
          })}
        </g>
      </svg>
      <div className="minimap-caption">Selecciona un distrito para acercarte</div>
    </aside>
  );
}
