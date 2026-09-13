"use client";
import { PointerLockControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Vector3 } from "three";
import { terrainHeight } from "@/lib/city/terrain";
import type { CityModel } from "@/types/city";

export function Player({ city }: { city: CityModel }) {
  const { camera, gl } = useThree();
  const keys = useRef(new Set<string>());
  const vectors = useMemo(() => ({ forward: new Vector3(), right: new Vector3(), next: new Vector3() }), []);
  useEffect(() => {
    const core = city.buildings.find((b) => b.id === city.coreBuildingId);
    if (core) {
      const targetDistance = Math.max(14, Math.max(core.width, core.depth) * 1.8);
      const vantage = city.roads
        .flatMap((road) => {
          const dx = road.to[0] - road.from[0];
          const dz = road.to[1] - road.from[1];
          return [0.18, 0.5, 0.82].map((progress) => {
            const x = road.from[0] + dx * progress;
            const z = road.from[1] + dz * progress;
            const distance = Math.hypot(x - core.position[0], z - core.position[2]);
            return { road, x, z, dx, dz, distance };
          });
        })
        .filter((candidate) => candidate.distance >= targetDistance * 0.72)
        .sort((a, b) => Math.abs(a.distance - targetDistance) - Math.abs(b.distance - targetDistance))[0];
      if (vantage) {
        const length = Math.max(0.001, Math.hypot(vantage.dx, vantage.dz));
        const lane = vantage.road.width * 0.2;
        camera.position.set(
          vantage.x - (vantage.dz / length) * lane,
          2,
          vantage.z + (vantage.dx / length) * lane,
        );
      } else camera.position.set(core.position[0] + 4, 2, core.position[2] + 4);
      camera.lookAt(core.position[0], Math.min(4, core.height * 0.42), core.position[2]);
    }
    const down = (event: KeyboardEvent) => {
      if (document.pointerLockElement === gl.domElement) {
        if (["KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft"].includes(event.code)) event.preventDefault();
        keys.current.add(event.code);
      }
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.code);
    const clear = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    document.addEventListener("pointerlockchange", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      document.removeEventListener("pointerlockchange", clear);
    };
  }, [city, camera, gl]);
  useFrame((_, delta) => {
    if (document.pointerLockElement !== gl.domElement) return;
    const { forward, right, next } = vectors;
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, camera.up).normalize();
    const speed = (keys.current.has("ShiftLeft") ? 7 : 3.5) * Math.min(delta, 0.05);
    next.copy(camera.position);
    if (keys.current.has("KeyW")) next.addScaledVector(forward, speed);
    if (keys.current.has("KeyS")) next.addScaledVector(forward, -speed);
    if (keys.current.has("KeyD")) next.addScaledVector(right, speed);
    if (keys.current.has("KeyA")) next.addScaledVector(right, -speed);
    const blocked = (x: number, z: number) =>
      Math.abs(x) > city.bounds.width / 2 ||
      Math.abs(z) > city.bounds.depth / 2 ||
      city.buildings.some(
        (b) =>
          Math.abs(x - b.position[0]) < b.width * 0.67 + 0.2 &&
          Math.abs(z - b.position[2]) < b.depth * 0.67 + 0.2,
      );
    if (!blocked(next.x, camera.position.z)) camera.position.x = next.x;
    if (!blocked(camera.position.x, next.z)) camera.position.z = next.z;
    const urban = city.districts.some(
      (d) =>
        Math.abs(camera.position.x - d.position[0]) < d.size[0] / 2 + 3 &&
        Math.abs(camera.position.z - d.position[1]) < d.size[1] / 2 + 3,
    );
    const eye = (urban ? 0.45 : terrainHeight(camera.position.x, camera.position.z, city.districts)) + 1.65;
    camera.position.y += (eye - camera.position.y) * Math.min(1, delta * 12);
  });
  return <PointerLockControls makeDefault selector="#city-viewport" />;
}
