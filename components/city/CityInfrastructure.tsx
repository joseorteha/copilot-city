"use client";

import { useFrame } from "@react-three/fiber";
import { type RefObject, useLayoutEffect, useMemo, useRef } from "react";
import { InstancedMesh, Object3D, Points } from "three";

import { useCityStore } from "@/store/city-store";
import type { CityModel, Position3D } from "@/types/city";

function seeded(index: number) {
  const value = Math.sin(index * 128.31 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function useInstanceMatrices(ref: RefObject<InstancedMesh | null>, positions: Position3D[], scales: Position3D[]) {
  useLayoutEffect(() => {
    if (!ref.current) return;
    const dummy = new Object3D();
    positions.forEach((position, index) => {
      dummy.position.set(...position);
      dummy.rotation.y = seeded(index) * Math.PI * 2;
      dummy.scale.set(...scales[index]);
      dummy.updateMatrix();
      ref.current?.setMatrixAt(index, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [positions, ref, scales]);
}

function UrbanForest({ city }: { city: CityModel }) {
  const trunks = useRef<InstancedMesh>(null);
  const crowns = useRef<InstancedMesh>(null);
  const positions = useMemo(() => city.districts.flatMap((district, districtIndex) => {
    const [cx, cz] = district.position;
    const [w, d] = district.size;
    return Array.from({ length: Math.max(4, Math.min(12, Math.floor((w + d) / 3))) }, (_, index) => {
      const edge = index % 4;
      const along = -0.42 + seeded(districtIndex * 31 + index) * 0.84;
      const x = edge < 2 ? cx + (edge === 0 ? -w * 0.43 : w * 0.43) : cx + along * w;
      const z = edge >= 2 ? cz + (edge === 2 ? -d * 0.43 : d * 0.43) : cz + along * d;
      return [x, 0.48, z] as Position3D;
    });
  }), [city.districts]);
  const trunkScales = useMemo(() => positions.map((_, index) => [0.055, 0.52 + seeded(index) * 0.28, 0.055] as Position3D), [positions]);
  const crownPositions = useMemo(() => positions.map((item, index) => [item[0], item[1] + 0.62 + seeded(index) * 0.2, item[2]] as Position3D), [positions]);
  const crownScales = useMemo(() => positions.map((_, index) => {
    const size = 0.28 + seeded(index + 99) * 0.18;
    return [size, size * 1.22, size] as Position3D;
  }), [positions]);
  useInstanceMatrices(trunks, positions, trunkScales);
  useInstanceMatrices(crowns, crownPositions, crownScales);

  return <group>
    <instancedMesh ref={trunks} args={[undefined, undefined, positions.length]} castShadow receiveShadow><cylinderGeometry args={[1, 1.25, 1, 7]} /><meshStandardMaterial color="#55483c" roughness={1} /></instancedMesh>
    <instancedMesh ref={crowns} args={[undefined, undefined, positions.length]} castShadow><icosahedronGeometry args={[1, 1]} /><meshStandardMaterial color="#426653" roughness={0.92} envMapIntensity={0.45} /></instancedMesh>
  </group>;
}

function DataTraffic({ city }: { city: CityModel }) {
  const mesh = useRef<InstancedMesh>(null);
  const visualMode = useCityStore((state) => state.visualMode);
  const traffic = useMemo(() => city.roads.flatMap((road, roadIndex) => {
    const count = Math.min(4, Math.max(1, Math.round(road.strength / 2)));
    return Array.from({ length: count }, (_, index) => ({ road, roadIndex, offset: index / count + seeded(roadIndex * 17 + index) * 0.2, speed: 0.018 + seeded(roadIndex * 53 + index) * 0.028 }));
  }).slice(0, 90), [city.roads]);
  const dummy = useMemo(() => new Object3D(), []);

  useFrame(({ clock }) => {
    if (!mesh.current) return;
    traffic.forEach(({ road, offset, speed }, index) => {
      const progress = (clock.elapsedTime * speed + offset) % 1;
      const dx = road.to[0] - road.from[0];
      const dz = road.to[1] - road.from[1];
      dummy.position.set(road.from[0] + dx * progress, road.kind === "bridge" ? 0.72 : 0.48, road.from[1] + dz * progress);
      dummy.rotation.set(0, Math.atan2(dx, dz), 0);
      dummy.scale.set(0.1, 0.06, road.kind === "avenue" ? 0.46 : 0.34);
      dummy.updateMatrix();
      mesh.current?.setMatrixAt(index, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[undefined, undefined, traffic.length]} frustumCulled={false}>
    <boxGeometry />
    <meshStandardMaterial color={visualMode === "night" ? "#ffe0a1" : "#d6bd77"} emissive={visualMode === "night" ? "#ffbd55" : "#695520"} emissiveIntensity={visualMode === "night" ? 2.2 : 0.42} roughness={0.32} />
  </instancedMesh>;
}

function StreetLights({ city }: { city: CityModel }) {
  const posts = useRef<InstancedMesh>(null);
  const lamps = useRef<InstancedMesh>(null);
  const visualMode = useCityStore((state) => state.visualMode);
  const positions = useMemo(() => city.roads.flatMap((road, roadIndex) => {
    const dx = road.to[0] - road.from[0];
    const dz = road.to[1] - road.from[1];
    const length = Math.max(0.001, Math.hypot(dx, dz));
    const nx = -dz / length;
    const nz = dx / length;
    const count = Math.min(8, Math.max(2, Math.floor(length / 4)));
    return Array.from({ length: count }, (_, index) => {
      const progress = (index + 0.5) / count;
      const side = (index + roadIndex) % 2 ? 1 : -1;
      return [road.from[0] + dx * progress + nx * side * (road.width / 2 + 0.34), 0.94, road.from[1] + dz * progress + nz * side * (road.width / 2 + 0.34)] as Position3D;
    });
  }).slice(0, 120), [city.roads]);
  const postScales = useMemo(() => positions.map(() => [0.035, 1.18, 0.035] as Position3D), [positions]);
  const lampPositions = useMemo(() => positions.map(([x, , z]) => [x, 1.59, z] as Position3D), [positions]);
  const lampScales = useMemo(() => positions.map(() => [0.09, 0.09, 0.09] as Position3D), [positions]);
  useInstanceMatrices(posts, positions, postScales);
  useInstanceMatrices(lamps, lampPositions, lampScales);
  return <group>
    <instancedMesh ref={posts} args={[undefined, undefined, positions.length]} castShadow><cylinderGeometry args={[1, 1.1, 1, 7]} /><meshStandardMaterial color="#3d4b49" metalness={0.55} roughness={0.45} /></instancedMesh>
    <instancedMesh ref={lamps} args={[undefined, undefined, positions.length]}><sphereGeometry args={[1, 9, 7]} /><meshStandardMaterial color="#ffe3a6" emissive="#ffbc55" emissiveIntensity={visualMode === "night" ? 3.4 : 0.35} roughness={0.18} /></instancedMesh>
  </group>;
}

function AtmosphericParticles({ city }: { city: CityModel }) {
  const points = useRef<Points>(null);
  const visualMode = useCityStore((state) => state.visualMode);
  const positions = useMemo(() => {
    const values = new Float32Array(360 * 3);
    for (let index = 0; index < 360; index += 1) {
      values[index * 3] = (seeded(index) - 0.5) * city.bounds.width * 1.35;
      values[index * 3 + 1] = 0.8 + seeded(index + 400) * 13;
      values[index * 3 + 2] = (seeded(index + 800) - 0.5) * city.bounds.depth * 1.35;
    }
    return values;
  }, [city.bounds.depth, city.bounds.width]);
  useFrame(({ clock }) => { if (points.current) points.current.rotation.y = clock.elapsedTime * 0.006; });
  return <points ref={points}><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry><pointsMaterial color={visualMode === "night" ? "#9ad8d1" : "#f1d9a3"} size={visualMode === "night" ? 0.045 : 0.026} transparent opacity={visualMode === "night" ? 0.48 : 0.22} depthWrite={false} /></points>;
}

export function CityInfrastructure({ city }: { city: CityModel }) {
  return <group><UrbanForest city={city} /><StreetLights city={city} /><DataTraffic city={city} /><AtmosphericParticles city={city} /></group>;
}
