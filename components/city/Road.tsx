"use client";

import { useFrame } from "@react-three/fiber";
import { useCityStore } from "@/store/city-store";
import { useEffect, useMemo, useRef } from "react";
import { BoxGeometry, BufferGeometry, CircleGeometry, Group, Matrix4 } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { roadTexture } from "@/components/city/road-texture";
import type { CityRoad } from "@/types/city";

const BRIDGE_DECK = 0.55;

/** Four merged meshes for the whole network: pavement, kerbs, lane markings and bridges. */
export function RoadNetwork({ roads }: { roads: CityRoad[] }) {
  const group = useRef<Group>(null);
  const progress = useRef(0);
  // Asphalt after rain: the single cheapest way to make a night city read as a night city,
  // because the whole street turns into a mirror for the lamps and the lit facades.
  const night = useCityStore((state) => state.visualMode) === "night";

  const geometries = useMemo(() => {
    const pavement: BufferGeometry[] = [],
      kerbs: BufferGeometry[] = [],
      marks: BufferGeometry[] = [],
      structure: BufferGeometry[] = [],
      medians: BufferGeometry[] = [],
      details: BufferGeometry[] = [];
    const add = (
      out: BufferGeometry[],
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      rotation: number,
    ) => {
      const geometry = new BoxGeometry(w, h, d);
      geometry.applyMatrix4(new Matrix4().makeRotationY(rotation));
      geometry.translate(x, y, z);
      out.push(geometry);
    };

    const junctions = new Map<string, { x: number; z: number; width: number; count: number }>();
    for (const road of roads) {
      for (const point of [road.from, road.to]) {
        const key = `${point[0].toFixed(2)}:${point[1].toFixed(2)}`;
        const entry = junctions.get(key);
        if (entry) {
          entry.width = Math.max(entry.width, road.width);
          entry.count += 1;
        } else junctions.set(key, { x: point[0], z: point[1], width: road.width, count: 1 });
      }
    }

    for (const junction of junctions.values()) {
      if (junction.count < 2) continue;
      const geometry = new CircleGeometry(junction.width * 0.54, 18).rotateX(-Math.PI / 2);
      geometry.translate(junction.x, 0.112, junction.z);
      pavement.push(geometry);
    }

    for (const road of roads) {
      const dx = road.to[0] - road.from[0],
        dz = road.to[1] - road.from[1],
        length = Math.hypot(dx, dz);
      const angle = Math.atan2(dx, dz),
        x = (road.from[0] + road.to[0]) / 2,
        z = (road.from[1] + road.to[1]) / 2;
      const bridge = road.kind === "bridge";
      const deck = bridge ? BRIDGE_DECK : 0.04;

      add(pavement, road.width, 0.14, length + 0.1, x, deck, z, angle);
      for (const side of [-1, 1]) {
        const offset = side * (road.width / 2 + 0.17);
        add(
          kerbs,
          0.34,
          bridge ? 0.34 : 0.1,
          length,
          x + Math.cos(angle) * offset,
          deck + (bridge ? 0.18 : 0.06),
          z - Math.sin(angle) * offset,
          angle,
        );
      }

      if (bridge) {
        // Piers every few units keep the deck from reading as a floating ribbon.
        const piers = Math.max(2, Math.round(length / 5));
        for (let index = 0; index < piers; index += 1) {
          const t = (index + 0.5) / piers;
          add(
            structure,
            road.width * 0.34,
            deck + 1.4,
            road.width * 0.34,
            road.from[0] + dx * t,
            deck / 2 - 0.7,
            road.from[1] + dz * t,
            angle,
          );
        }
      }

      if (road.kind === "avenue" || bridge) {
        if (!bridge && length > 4) add(medians, 0.18, 0.09, length - 0.8, x, 0.145, z, angle);
        const count = Math.floor(length / 2);
        for (let i = 0; i < count; i++) {
          const t = (i + 0.5) / Math.max(1, count);
          for (const lane of [-1, 1]) {
            const offset = lane * road.width * 0.27;
            add(
              marks,
              0.045,
              0.012,
              0.54,
              road.from[0] + dx * t + Math.cos(angle) * offset,
              deck + 0.076,
              road.from[1] + dz * t - Math.sin(angle) * offset,
              angle,
            );
          }
        }
      }

      if (road.id.startsWith("street:")) {
        // Zebra crossing aligned to the street itself, not to the world axes.
        for (const end of [road.from, road.to]) {
          const toward = end === road.from ? 1 : -1;
          for (let stripe = 0; stripe < 5; stripe += 1) {
            const distance = 0.42 + stripe * 0.19;
            add(
              marks,
              road.width * 0.74,
              0.014,
              0.095,
              end[0] + (dx / Math.max(length, 0.001)) * distance * toward,
              0.118,
              end[1] + (dz / Math.max(length, 0.001)) * distance * toward,
              angle,
            );
          }
        }
      }

      // Storm drains sit beside the kerb and provide the tiny dark repetitions that make
      // the road scale believable from a low camera.
      if (!bridge && length > 5) {
        for (const side of [-1, 1]) {
          const offset = side * (road.width / 2 - 0.18);
          add(
            details,
            0.24,
            0.012,
            0.42,
            x + Math.cos(angle) * offset,
            0.119,
            z - Math.sin(angle) * offset,
            angle,
          );
        }
      }
    }

    return [pavement, kerbs, marks, structure, medians, details].map((list) => {
      const compatible = list.map((geometry) => (geometry.index ? geometry.toNonIndexed() : geometry));
      const merged = compatible.length ? mergeGeometries(compatible) : new BufferGeometry();
      compatible.forEach((geometry, index) => {
        if (geometry !== list[index]) geometry.dispose();
      });
      list.forEach((geometry) => geometry.dispose());
      return merged!;
    });
  }, [roads]);

  useEffect(() => () => geometries.forEach((geometry) => geometry.dispose()), [geometries]);

  useFrame((_, delta) => {
    if (!group.current || progress.current >= 1) return;
    progress.current = Math.min(1, progress.current + delta * 1.3);
    group.current.scale.y = Math.max(0.01, progress.current);
  });

  return (
    <group ref={group}>
      <mesh name="roads:pavement" geometry={geometries[0]} receiveShadow>
        <meshStandardMaterial
          color={night ? "#11181d" : "#465351"}
          map={roadTexture("albedo")}
          roughnessMap={roadTexture("roughness")}
          bumpMap={roadTexture("height")}
          bumpScale={0.035}
          roughness={night ? 0.14 : 0.82}
          metalness={night ? 0.72 : 0.08}
          envMapIntensity={night ? 2.6 : 0.9}
        />
      </mesh>
      <mesh name="roads:kerbs" geometry={geometries[1]} receiveShadow>
        <meshStandardMaterial color="#d4d1c3" roughness={0.86} metalness={0.06} />
      </mesh>
      <mesh name="roads:markings" geometry={geometries[2]}>
        <meshStandardMaterial
          color="#f0d890"
          roughness={0.5}
          emissive="#f0d890"
          emissiveIntensity={night ? 0.55 : 0}
        />
      </mesh>
      <mesh name="roads:bridges" geometry={geometries[3]} castShadow receiveShadow>
        <meshStandardMaterial color="#9d9a8c" roughness={0.92} />
      </mesh>
      <mesh name="roads:medians" geometry={geometries[4]} receiveShadow>
        <meshStandardMaterial color={night ? "#29463b" : "#5f7f62"} roughness={0.96} />
      </mesh>
      <mesh name="roads:details" geometry={geometries[5]}>
        <meshStandardMaterial color="#20292a" roughness={0.5} metalness={0.62} />
      </mesh>
    </group>
  );
}
