"use client";

import { Environment, Lightformer } from "@react-three/drei";

import { useCityStore } from "@/store/city-store";
import type { CityBounds } from "@/types/city";

export function CityLighting({ bounds }: { bounds: CityBounds }) {
  const visualMode = useCityStore((state) => state.visualMode);
  const quality = useCityStore((state) => state.quality);
  const night = visualMode === "night";
  const shadowExtent = Math.max(28, Math.min(85, Math.max(bounds.width, bounds.depth) * 0.7));
  const shadowSize = quality === "low" ? 1024 : 2048;

  return <>
    <hemisphereLight args={[night ? "#52758a" : "#d5e4df", night ? "#071311" : "#30443b", night ? 0.58 : 1.15]} />
    <ambientLight intensity={night ? 0.1 : 0.18} color={night ? "#7892ab" : "#e8eee8"} />
    <directionalLight
      castShadow
      position={night ? [-shadowExtent * 0.7, shadowExtent * 0.9, -shadowExtent * 0.22] : [-shadowExtent * 0.55, shadowExtent, shadowExtent * 0.42]}
      intensity={night ? 1.1 : 2.65}
      color={night ? "#9fb7da" : "#ffe5bd"}
      shadow-mapSize-width={shadowSize}
      shadow-mapSize-height={shadowSize}
      shadow-camera-near={1}
      shadow-camera-far={shadowExtent * 3}
      shadow-camera-left={-shadowExtent}
      shadow-camera-right={shadowExtent}
      shadow-camera-top={shadowExtent}
      shadow-camera-bottom={-shadowExtent}
      shadow-bias={-0.00014}
      shadow-normalBias={0.035}
    />
    <Environment resolution={quality === "low" ? 64 : 128} frames={1} environmentIntensity={night ? 0.35 : 0.72}>
      <Lightformer form="rect" intensity={night ? 1.1 : 2.2} color={night ? "#7aa7c8" : "#fff0d6"} position={[-10, 12, 8]} scale={[14, 14, 1]} target={[0, 2, 0]} />
      <Lightformer form="ring" intensity={night ? 0.7 : 1.1} color={night ? "#4cb1a9" : "#c8e3dd"} position={[12, 5, -10]} scale={8} target={[0, 1, 0]} />
      <Lightformer form="rect" intensity={night ? 0.35 : 0.65} color="#d9bd83" position={[0, 4, 14]} scale={[18, 3, 1]} target={[0, 2, 0]} />
    </Environment>
  </>;
}
