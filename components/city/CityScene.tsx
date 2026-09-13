"use client";

import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Bloom,
  BrightnessContrast,
  EffectComposer,
  HueSaturation,
  N8AO,
  Vignette,
} from "@react-three/postprocessing";
import { type RefObject, Suspense, useEffect, useRef } from "react";
import { AgXToneMapping, Mesh, PCFShadowMap, SRGBColorSpace, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import { CityLighting, HORIZON_COLOR } from "@/components/city/CityLighting";
import { Player } from "./Player";
import { CityWorld } from "@/components/city/CityWorld";
import { useCityStore } from "@/store/city-store";
import type { CityModel } from "@/types/city";

function SceneLoader() {
  return (
    <Html center>
      <div className="scene-loader">
        <span />
        Levantando arquitectura
      </div>
    </Html>
  );
}

/** Opt-in renderer counters for the automated visual benchmark (`?perf=1`). */
function RendererProbe() {
  const enabled = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("perf");
  const sample = useRef(0);
  useFrame(({ gl, scene }) => {
    if (!enabled) return;
    sample.current += 1;
    if (sample.current % 30 !== 0) return;
    gl.domElement.dataset.drawCalls = String(gl.info.render.calls);
    gl.domElement.dataset.triangles = String(gl.info.render.triangles);
    gl.domElement.dataset.geometries = String(gl.info.memory.geometries);
    gl.domElement.dataset.textures = String(gl.info.memory.textures);
    gl.domElement.dataset.shadowMap = String(gl.shadowMap.enabled);
    gl.domElement.dataset.programs = String(gl.info.programs?.length ?? 0);
    let visibleMeshes = 0;
    let materialPasses = 0;
    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      let current = object.parent;
      let visible = object.visible;
      while (visible && current) {
        visible = current.visible;
        current = current.parent;
      }
      if (!visible) return;
      visibleMeshes += 1;
      materialPasses += Array.isArray(object.material) ? Math.max(1, object.geometry.groups.length) : 1;
    });
    gl.domElement.dataset.visibleMeshes = String(visibleMeshes);
    gl.domElement.dataset.materialPasses = String(materialPasses);
  });
  return null;
}

function CameraSetup({ city, viewMode }: { city: CityModel; viewMode: "map" | "explore" }) {
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    // Framed so the city fills the shot. At 0.92 of the radius it sat in the middle of an
    // empty lawn, which read as an unfinished scene more than any single material did.
    const distance = Math.max(20, city.bounds.radius * 0.66);
    if (viewMode === "map") camera.position.set(distance * 0.78, distance * 0.46, distance * 0.84);
    camera.near = 0.1;
    camera.far = Math.max(180, distance * 5);
    camera.lookAt(0, 2.5, 0);
    camera.updateProjectionMatrix();
  }, [camera, city, viewMode]);
  return null;
}

function FocusCamera({ city, controls }: { city: CityModel; controls: RefObject<OrbitControlsImpl | null> }) {
  const selectedId = useCityStore((state) => state.selectedBuildingId);
  const focusVersion = useCityStore((state) => state.focusVersion);
  const camera = useThree((state) => state.camera);
  const destination = useRef<Vector3 | null>(null);
  const target = useRef<Vector3 | null>(null);

  useEffect(() => {
    if (!focusVersion || !selectedId) return;
    const building = city.buildings.find((candidate) => candidate.id === selectedId);
    if (!building) return;
    const distance = Math.max(11.5, building.height * 1.18);
    const focus = new Vector3(
      building.position[0],
      Math.min(building.height * 0.55, 5),
      building.position[2],
    );
    // Approach along the bearing the viewer is already looking from. A fixed +x/+z offset
    // regularly parked the camera behind a neighbouring block.
    const bearing = camera.position.clone().sub(focus).setY(0);
    if (bearing.lengthSq() < 1e-4) bearing.set(1, 0, 0.88);
    bearing.normalize().multiplyScalar(distance);
    target.current = focus;
    destination.current = new Vector3(
      focus.x + bearing.x,
      Math.max(7.5, building.height * 0.82),
      focus.z + bearing.z,
    );
  }, [camera, city, focusVersion, selectedId]);

  useFrame((_, delta) => {
    if (!destination.current || !target.current || !controls.current) return;
    const factor = 1 - Math.exp(-delta * 4.2);
    camera.position.lerp(destination.current, factor);
    controls.current.target.lerp(target.current, factor);
    controls.current.update();
    if (camera.position.distanceTo(destination.current) < 0.05) {
      destination.current = null;
      target.current = null;
    }
  });
  return null;
}

function CinematicCamera({
  city,
  controls,
}: {
  city: CityModel;
  controls: RefObject<OrbitControlsImpl | null>;
}) {
  const version = useCityStore((state) => state.cinematicVersion);
  const camera = useThree((state) => state.camera);
  const startedAt = useRef<number | null>(null);
  useEffect(() => {
    if (!version) return;
    startedAt.current = -1;
    if (controls.current) controls.current.enabled = false;
  }, [controls, version]);
  useFrame(({ clock }) => {
    if (startedAt.current === null) return;
    if (startedAt.current < 0) startedAt.current = clock.elapsedTime;
    const elapsed = clock.elapsedTime - startedAt.current;
    const duration = 11;
    const progress = Math.min(1, elapsed / duration);
    const eased = progress * progress * (3 - 2 * progress);
    const radius = Math.max(18, city.bounds.radius * (1.08 - eased * 0.24));
    const angle = -0.35 + eased * Math.PI * 1.45;
    camera.position.set(
      Math.cos(angle) * radius,
      radius * (0.52 - eased * 0.12) + 3,
      Math.sin(angle) * radius,
    );
    const targetY = 2.4 + Math.sin(eased * Math.PI) * 2;
    camera.lookAt(0, targetY, 0);
    if (progress >= 1) {
      startedAt.current = null;
      if (controls.current) {
        controls.current.enabled = true;
        controls.current.target.set(0, 2.5, 0);
        controls.current.update();
      }
    }
  });
  return null;
}

/**
 * Renders once and reads the buffer in the same tick, which is what makes the capture
 * valid without paying `preserveDrawingBuffer` on every frame of the session.
 */
function PhotoCapture({ city }: { city: CityModel }) {
  const version = useCityStore((state) => state.photoVersion);
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    if (!version) return;
    const frame = requestAnimationFrame(() => {
      gl.render(scene, camera);
      gl.domElement.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${city.repository.name}-copilot-city.png`;
        link.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    });
    return () => cancelAnimationFrame(frame);
  }, [camera, city.repository.name, gl, scene, version]);
  return null;
}

function RendererSettings({ night, highQuality }: { night: boolean; highQuality: boolean }) {
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    gl.toneMappingExposure = night ? 0.74 : 1.26;
    gl.shadowMap.autoUpdate = true;
    gl.shadowMap.needsUpdate = true;
    if (highQuality) return;
    const timer = window.setTimeout(() => {
      gl.shadowMap.needsUpdate = true;
      gl.shadowMap.autoUpdate = false;
    }, 2600);
    return () => window.clearTimeout(timer);
  }, [gl, highQuality, night]);
  return null;
}

/**
 * The grade, in order: ambient occlusion to seat the massing, bloom so lit windows and
 * street lamps read as light sources rather than pale stickers, then a light contrast and
 * saturation push and a vignette. Bloom is what the night view was missing entirely.
 */
function CityPostProcessing({ highQuality, night }: { highQuality: boolean; night: boolean }) {
  return (
    <EffectComposer multisampling={0} enableNormalPass={highQuality}>
      {highQuality && (
        <N8AO
          halfRes
          aoRadius={highQuality ? 2.1 : 1.3}
          distanceFalloff={0.75}
          intensity={highQuality ? 1.5 : 0.9}
          quality={highQuality ? "medium" : "performance"}
          color={night ? "#050d12" : "#141d1c"}
        />
      )}
      <Bloom
        mipmapBlur
        // Night lets far more of the frame through the threshold, which is the point: the
        // glow has to come off the windows, not off the whole facade.
        luminanceThreshold={night ? 0.42 : 0.92}
        luminanceSmoothing={0.28}
        intensity={night ? 1.05 : 0.12}
        radius={night ? 0.82 : 0.6}
        levels={highQuality ? 5 : 3}
      />
      <HueSaturation saturation={night ? 0.12 : 0.06} />
      <BrightnessContrast brightness={night ? 0.015 : 0} contrast={night ? 0.09 : 0.05} />
      <Vignette eskil={false} offset={0.22} darkness={night ? 0.42 : 0.26} />
    </EffectComposer>
  );
}

export function CityScene({ city, preview = false }: { city: CityModel; preview?: boolean }) {
  const selectBuilding = useCityStore((state) => state.selectBuilding);
  const viewMode = useCityStore((state) => state.viewMode);
  const visualMode = useCityStore((state) => state.visualMode);
  const quality = useCityStore((state) => state.quality);
  const controls = useRef<OrbitControlsImpl>(null);
  const maxDistance = Math.max(48, city.bounds.radius * 2.4);
  const highQuality = quality === "high";
  const night = visualMode === "night";

  return (
    <Canvas
      key={city.repository.fullName}
      shadows={highQuality}
      dpr={quality === "high" ? [1, 1.3] : quality === "low" ? 0.6 : 0.7}
      camera={{ position: [24, 18, 26], fov: 42, near: 0.1, far: 240 }}
      gl={{ antialias: highQuality, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.shadowMap.type = PCFShadowMap;
        gl.domElement.id = "city-viewport";
        gl.toneMapping = AgXToneMapping;
        gl.toneMappingExposure = night ? 0.74 : 1.26;
        gl.outputColorSpace = SRGBColorSpace;
      }}
      onPointerMissed={() => selectBuilding(null)}
    >
      <color attach="background" args={[night ? HORIZON_COLOR.night : HORIZON_COLOR.day]} />
      {/* Fog closes on the same colour as the sky dome's horizon and, crucially, well before
        the edge of the ground plane — otherwise the terrain's square silhouette shows. */}
      <fog
        attach="fog"
        args={[
          night ? HORIZON_COLOR.night : HORIZON_COLOR.day,
          city.bounds.radius * 1.6,
          city.bounds.radius * 3.4,
        ]}
      />
      <Suspense fallback={<SceneLoader />}>
        <CameraSetup city={city} viewMode={viewMode} />
        <RendererProbe />
        <CityLighting bounds={city.bounds} />
        <CityWorld city={city} />
        <RendererSettings night={night} highQuality={highQuality} />
        <PhotoCapture city={city} />
        {viewMode === "map" ? (
          <>
            <FocusCamera city={city} controls={controls} />
            <CinematicCamera city={city} controls={controls} />
            <OrbitControls
              ref={controls}
              makeDefault
              target={[0, 2.5, 0]}
              autoRotate={preview}
              autoRotateSpeed={0.28}
              enableDamping
              dampingFactor={0.075}
              minDistance={6}
              maxDistance={maxDistance}
              minPolarAngle={0.34}
              maxPolarAngle={Math.PI / 2.06}
              screenSpacePanning={false}
              regress
            />
          </>
        ) : (
          <Player city={city} />
        )}
        {highQuality && <CityPostProcessing highQuality night={night} />}
      </Suspense>
    </Canvas>
  );
}
