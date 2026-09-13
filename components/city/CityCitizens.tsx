"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Group } from "three";

import { useCityStore } from "@/store/city-store";
import type { CityModel, Position3D } from "@/types/city";

function Citizen({
  origin,
  index,
  name,
  clearance,
}: {
  origin: Position3D;
  index: number;
  name: string;
  clearance: number;
}) {
  const group = useRef<Group>(null);
  const hue = useMemo(
    () => [...name].reduce((sum, character) => (sum * 31 + character.charCodeAt(0)) % 360, 0),
    [name],
  );
  useFrame(({ clock }) => {
    if (!group.current) return;
    const time = clock.elapsedTime * (0.18 + (index % 3) * 0.025) + index * 1.7;
    // Walk outside the footprint: a fixed radius used to run straight through the facade.
    const radius = clearance + (index % 2) * 0.35;
    group.current.position.set(
      origin[0] + Math.cos(time) * radius,
      0.12,
      origin[2] + Math.sin(time) * radius,
    );
    group.current.rotation.y = -time + Math.PI / 2;
  });
  return (
    <group ref={group} scale={0.7}>
      <mesh position={[0, 0.48, 0]} castShadow>
        <capsuleGeometry args={[0.09, 0.28, 4, 8]} />
        <meshStandardMaterial color={`hsl(${hue}, 28%, 54%)`} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.79, 0]} castShadow>
        <sphereGeometry args={[0.105, 10, 8]} />
        <meshStandardMaterial color="#bd9d7f" roughness={0.92} />
      </mesh>
      <mesh position={[-0.06, 0.16, 0]} rotation={[0, 0, -0.08]}>
        <capsuleGeometry args={[0.035, 0.22, 3, 6]} />
        <meshStandardMaterial color="#303b3a" />
      </mesh>
      <mesh position={[0.06, 0.16, 0]} rotation={[0, 0, 0.08]}>
        <capsuleGeometry args={[0.035, 0.22, 3, 6]} />
        <meshStandardMaterial color="#303b3a" />
      </mesh>
    </group>
  );
}

export function CityCitizens({ city }: { city: CityModel }) {
  const viewMode=useCityStore((state)=>state.viewMode);
  const core = city.buildings.find((building) => building.id === city.coreBuildingId) ?? city.buildings[0];
  if (!core || viewMode!=="explore") return null;
  return (
    <group>
      {city.insights.contributors.slice(0, 8).map((person, index) => {
        const workplace =
          city.buildings.find((building) => building.metrics.primaryAuthor === person.login) ??
          city.buildings[index % city.buildings.length] ??
          core;
        const clearance = Math.max(workplace.width, workplace.depth) * 0.8 + 0.75;
        return (
          <Citizen
            key={person.login}
            origin={workplace.position}
            index={index}
            name={person.login}
            clearance={clearance}
          />
        );
      })}
    </group>
  );
}
