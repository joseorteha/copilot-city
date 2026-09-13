"use client";

import { Environment, Lightformer, Stars } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { BackSide, Color, Mesh, Vector3 } from "three";

import { useCityStore } from "@/store/city-store";
import type { CityBounds } from "@/types/city";

/**
 * Sun direction, shared by the shader dome and the shadow-casting light: a low afternoon
 * angle, because at this scale the shadow a building throws is what says how tall it is.
 */
export const SUN_DIRECTION = new Vector3(-0.86, 0.5, 0.38).normalize();
export const HORIZON_COLOR = { day: "#b9c8cf", night: "#12282e" };

function AtmosphereDome({ night, radius }: { night: boolean; radius: number }) {
  const dome = useRef<Mesh>(null);
  useFrame(({ camera }) => dome.current?.position.copy(camera.position));
  return (
    <mesh ref={dome} scale={radius} frustumCulled={false} renderOrder={-1000}>
      <sphereGeometry args={[1, 48, 24]} />
      <shaderMaterial
        side={BackSide}
        depthWrite={false}
        depthTest={false}
        uniforms={{
          topColor: { value: new Color(night ? "#07171e" : "#4d87ab") },
          horizonColor: { value: new Color(night ? HORIZON_COLOR.night : HORIZON_COLOR.day) },
          sunColor: { value: new Color(night ? "#4f7184" : "#ffe9bd") },
          sunDirection: { value: SUN_DIRECTION.clone() },
        }}
        vertexShader={`varying vec3 vDirection; void main(){ vDirection=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`}
        fragmentShader={`
        uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 sunColor; uniform vec3 sunDirection;
        varying vec3 vDirection;
        void main(){
          float h = smoothstep(-.22, .78, vDirection.y);
          vec3 sky = mix(horizonColor, topColor, h);
          float aligned = max(dot(vDirection, sunDirection), 0.0);
          // A wide halo plus a soft disc, so the sun reads as light rather than a hard blob.
          float halo = pow(aligned, 6.0) * .3 + pow(aligned, 48.0) * .45;
          gl_FragColor = vec4(mix(sky, sunColor, clamp(halo, 0.0, .85)), 1.0);
        }
      `}
      />
    </mesh>
  );
}

export function CityLighting({ bounds }: { bounds: CityBounds }) {
  const visualMode = useCityStore((state) => state.visualMode);
  const quality = useCityStore((state) => state.quality);
  const night = visualMode === "night";
  const shadowExtent = Math.max(34, Math.min(120, Math.max(bounds.width, bounds.depth) * 0.62));
  const shadowSize = quality === "high" ? 2048 : 1024;
  const sunDistance = shadowExtent * 1.8;
  const sun = SUN_DIRECTION.clone().multiplyScalar(sunDistance);

  return (
    <>
      <AtmosphereDome night={night} radius={Math.max(160, bounds.radius * 2.6)} />
      {night && (
        <Stars
          radius={Math.max(80, bounds.radius * 2)}
          depth={45}
          count={1200}
          factor={2.4}
          saturation={0.1}
          fade
          speed={0.18}
        />
      )}
      {/* Fill is deliberately low: it is what was flattening the massing before. */}
      {/* Sky-blue fill against a warm sun: the colour separation the flat olive render had
          none of. Shadows go cool, lit faces go warm, and the massing reads. */}
      <hemisphereLight
        args={[night ? "#42637a" : "#9dc2dc", night ? "#071311" : "#4a5a48", night ? 0.34 : 0.46]}
      />
      <ambientLight intensity={night ? 0.08 : 0.07} color={night ? "#7892ab" : "#cfe0ea"} />
      <directionalLight
        castShadow={quality === "high"}
        position={night ? [-sun.x * 0.8, sunDistance * 0.75, -sun.z * 0.6] : [sun.x, sun.y, sun.z]}
        intensity={night ? 1.05 : 3.9}
        color={night ? "#9fb7da" : "#ffdfb0"}
        shadow-mapSize-width={shadowSize}
        shadow-mapSize-height={shadowSize}
        shadow-camera-near={1}
        shadow-camera-far={sunDistance * 3}
        shadow-camera-left={-shadowExtent}
        shadow-camera-right={shadowExtent}
        shadow-camera-top={shadowExtent}
        shadow-camera-bottom={-shadowExtent}
        shadow-bias={-0.00009}
        shadow-normalBias={0.02}
      />
      {night && (
        <directionalLight
          position={[sun.x * 0.6, sunDistance * 0.35, -sun.z * 1.2]}
          intensity={0.55}
          color="#6f9fd8"
        />
      )}
      <Environment
        files="/assets/city/environment/rural_asphalt_road_1k.hdr"
        resolution={quality === "low" ? 128 : 256}
        frames={1}
        environmentIntensity={night ? 0.48 : 0.62}
        environmentRotation={[0, -0.58, 0]}
      >
        {/* The glass is now near-mirror, so these lightformers read as reflections rather
            than as diffuse fill: they are shaped like what a city would actually see. */}
        <Lightformer
          form="rect"
          intensity={night ? 1.4 : 2.6}
          color={night ? "#7aa7c8" : "#fff3dd"}
          position={[-14, 16, 10]}
          scale={[18, 18, 1]}
          target={[0, 2, 0]}
        />
        <Lightformer
          form="rect"
          intensity={night ? 0.5 : 1.1}
          color={night ? "#1d3a4c" : "#bcd8e6"}
          position={[16, 14, -12]}
          scale={[26, 10, 1]}
          target={[0, 2, 0]}
        />
        {/* A warm band low on the horizon: sunset on glass by day, the sodium glow of the
            city bouncing off the cloud base at night. */}
        <Lightformer
          form="rect"
          intensity={night ? 1.1 : 1.4}
          color={night ? "#c2762f" : "#ffcf92"}
          position={[0, 1.6, 20]}
          scale={[34, 2.4, 1]}
          target={[0, 3, 0]}
        />
        <Lightformer
          form="ring"
          intensity={night ? 0.8 : 0.9}
          color={night ? "#4cb1a9" : "#d6ece6"}
          position={[12, 6, -10]}
          scale={9}
          target={[0, 1, 0]}
        />
      </Environment>
    </>
  );
}
