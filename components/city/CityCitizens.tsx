"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Group } from "three";

import type { CityModel, Position3D } from "@/types/city";

function Citizen({ origin, index, name }: { origin: Position3D; index: number; name: string }) {
  const group = useRef<Group>(null);
  const hue = useMemo(() => [...name].reduce((sum, character) => (sum * 31 + character.charCodeAt(0)) % 360, 0), [name]);
  useFrame(({ clock }) => {
    if (!group.current) return;
    const time = clock.elapsedTime * (.18 + (index % 3) * .025) + index * 1.7;
    const radius = 1.55 + (index % 2) * .35;
    group.current.position.set(origin[0] + Math.cos(time) * radius, .48, origin[2] + Math.sin(time) * radius);
    group.current.rotation.y = -time + Math.PI / 2;
  });
  return (
    <group ref={group}>
      <mesh position={[0, .48, 0]} castShadow><capsuleGeometry args={[.09, .28, 4, 8]} /><meshStandardMaterial color={`hsl(${hue}, 28%, 54%)`} roughness={.85} /></mesh>
      <mesh position={[0, .79, 0]} castShadow><sphereGeometry args={[.105, 10, 8]} /><meshStandardMaterial color="#bd9d7f" roughness={.92} /></mesh>
      <mesh position={[-.06, .16, 0]} rotation={[0, 0, -.08]}><capsuleGeometry args={[.035, .22, 3, 6]} /><meshStandardMaterial color="#303b3a" /></mesh>
      <mesh position={[.06, .16, 0]} rotation={[0, 0, .08]}><capsuleGeometry args={[.035, .22, 3, 6]} /><meshStandardMaterial color="#303b3a" /></mesh>
    </group>
  );
}

export function CityCitizens({ city }: { city: CityModel }) {
  const core = city.buildings.find((building) => building.id === city.coreBuildingId) ?? city.buildings[0];
  if (!core) return null;
  return <group>{city.insights.contributors.slice(0, 8).map((person, index) => {
    const workplace = city.buildings.find((building) => building.metrics.primaryAuthor === person.login) ?? city.buildings[index % city.buildings.length] ?? core;
    return <Citizen key={person.login} origin={workplace.position} index={index} name={person.login} />;
  })}</group>;
}
