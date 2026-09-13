"use client";

import { useEffect, useMemo } from "react";
import { Color, Float32BufferAttribute, PlaneGeometry } from "three";
import { terrainHeight } from "@/lib/city/terrain";
import { groundTexture } from "./ground-texture";
import { useCityStore } from "@/store/city-store";
import type { CityModel } from "@/types/city";

export function Ground({ city }: { city: CityModel }) {
  // Grass keeps its daylight vertex colours and is tinted towards moonlight after dark,
  // instead of staying the same muddy green under a blue sky.
  const night = useCityStore((state) => state.visualMode) === "night";
  const geometry = useMemo(() => {
    // The plane has to outrun the fog by a wide margin; anything shorter and the viewer
    // sees its square edge against the sky.
    const margin = city.bounds.radius * 6;
    const mesh = new PlaneGeometry(city.bounds.width + margin, city.bounds.depth + margin, 72, 72);
    mesh.rotateX(-Math.PI / 2);
    const positions = mesh.attributes.position,
      colors = new Float32Array(positions.count * 3);
    const low = new Color("#526653"),
      high = new Color("#8fa17a"),
      dry = new Color("#b4a276");
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i),
        z = positions.getZ(i),
        y = terrainHeight(x, z, city.districts);
      positions.setY(i, y);
      const noise =
        0.47 + Math.sin(x * 0.055) * Math.cos(z * 0.041) * 0.045 + Math.sin((x + z) * 0.018) * 0.03;
      const color = low
        .clone()
        .lerp(high, noise)
        .lerp(dry, Math.max(0, Math.sin(x * 0.017 - z * 0.023)) * 0.045);
      color.toArray(colors, i * 3);
    }
    mesh.setAttribute("color", new Float32BufferAttribute(colors, 3));
    mesh.computeVertexNormals();
    return mesh;
  }, [city.bounds.width, city.bounds.depth, city.bounds.radius, city.districts]);
  // One tile roughly every eight units: fine enough to give the eye a scale reference,
  // coarse enough that the pattern never announces itself.
  const detail = useMemo(
    () => groundTexture(Math.max(24, Math.round((city.bounds.width + city.bounds.radius * 8) / 8))),
    [city.bounds.width, city.bounds.radius],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      detail?.dispose();
    },
    [detail, geometry],
  );

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        vertexColors
        map={detail}
        color={night ? "#39505c" : "#ffffff"}
        roughness={0.94}
        metalness={0}
      />
    </mesh>
  );
}
