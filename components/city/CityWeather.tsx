"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { BufferAttribute, Points } from "three";

import type { CityModel } from "@/types/city";

const FAILURE_STATES = new Set(["failure", "cancelled", "timed_out", "action_required", "startup_failure"]);

export function CityWeather({ city }: { city: CityModel }) {
  const rain = useRef<Points>(null);
  const failing = Boolean(city.insights.ci?.conclusion && FAILURE_STATES.has(city.insights.ci.conclusion));
  const positions = useMemo(() => {
    const values = new Float32Array(720 * 3);
    let seed = 1729;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let index = 0; index < 720; index += 1) {
      values[index * 3] = (random() - 0.5) * city.bounds.width * 1.2;
      values[index * 3 + 1] = random() * 28 + 2;
      values[index * 3 + 2] = (random() - 0.5) * city.bounds.depth * 1.2;
    }
    return values;
  }, [city.bounds.depth, city.bounds.width]);

  useFrame((_, delta) => {
    if (!rain.current || !failing) return;
    const attribute = rain.current.geometry.getAttribute("position") as BufferAttribute;
    for (let index = 0; index < attribute.count; index += 1) {
      const y = attribute.getY(index) - delta * 13;
      attribute.setY(index, y < 0.3 ? 28 : y);
    }
    attribute.needsUpdate = true;
  });

  if (!failing) return null;
  return (
    <points ref={rain}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#b8d0cf" size={0.055} transparent opacity={0.48} depthWrite={false} />
    </points>
  );
}
