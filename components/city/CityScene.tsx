"use client";

import { AdaptiveDpr, Html, OrbitControls, PerformanceMonitor, PointerLockControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, N8AO, Vignette } from "@react-three/postprocessing";
import { type RefObject, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ACESFilmicToneMapping, MathUtils, PCFSoftShadowMap, SRGBColorSpace, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import { CityLighting } from "@/components/city/CityLighting";
import { CityWorld } from "@/components/city/CityWorld";
import { useCityStore } from "@/store/city-store";
import type { CityModel } from "@/types/city";

function SceneLoader() {
  return <Html center><div className="scene-loader"><span />Levantando arquitectura</div></Html>;
}

function CameraSetup({ city, viewMode }: { city: CityModel; viewMode: "map" | "explore" }) {
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    const distance = Math.max(22, city.bounds.radius * 1.12);
    if (viewMode === "map") camera.position.set(distance * 0.72, distance * 0.58, distance * 0.78);
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
    const distance = Math.max(6.5, building.height * 0.82);
    target.current = new Vector3(building.position[0], Math.min(building.height * 0.55, 5), building.position[2]);
    destination.current = new Vector3(building.position[0] + distance, Math.max(5, building.height * 0.7), building.position[2] + distance);
  }, [city, focusVersion, selectedId]);

  useFrame((_, delta) => {
    if (!destination.current || !target.current || !controls.current) return;
    const factor = 1 - Math.exp(-delta * 4.2);
    camera.position.lerp(destination.current, factor);
    controls.current.target.lerp(target.current, factor);
    controls.current.update();
    if (camera.position.distanceTo(destination.current) < 0.05) { destination.current = null; target.current = null; }
  });
  return null;
}

function CinematicCamera({ city, controls }: { city: CityModel; controls: RefObject<OrbitControlsImpl | null> }) {
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
    camera.position.set(Math.cos(angle) * radius, radius * (0.52 - eased * 0.12) + 3, Math.sin(angle) * radius);
    const targetY = 2.4 + Math.sin(eased * Math.PI) * 2;
    camera.lookAt(0, targetY, 0);
    if (progress >= 1) {
      startedAt.current = null;
      if (controls.current) { controls.current.enabled = true; controls.current.target.set(0, 2.5, 0); controls.current.update(); }
    }
  });
  return null;
}

function ExploreMovement({ city }: { city: CityModel }) {
  const camera = useThree((state) => state.camera);
  const keys = useRef(new Set<string>());
  const forward = useMemo(() => new Vector3(), []);
  const right = useMemo(() => new Vector3(), []);
  const core = city.buildings.find((building) => building.id === city.coreBuildingId) ?? city.buildings[0];
  useEffect(() => {
    if (core) camera.position.set(core.position[0] + 4, 1.75, core.position[2] + 6);
    const down = (event: KeyboardEvent) => keys.current.add(event.code);
    const up = (event: KeyboardEvent) => keys.current.delete(event.code);
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [camera, core]);
  useFrame((_, delta) => {
    camera.getWorldDirection(forward); forward.y = 0; forward.normalize(); right.crossVectors(forward, camera.up).normalize();
    const speed = (keys.current.has("ShiftLeft") ? 9 : 4.5) * delta;
    if (keys.current.has("KeyW")) camera.position.addScaledVector(forward, speed);
    if (keys.current.has("KeyS")) camera.position.addScaledVector(forward, -speed);
    if (keys.current.has("KeyA")) camera.position.addScaledVector(right, -speed);
    if (keys.current.has("KeyD")) camera.position.addScaledVector(right, speed);
    camera.position.x = MathUtils.clamp(camera.position.x, -city.bounds.width / 2, city.bounds.width / 2);
    camera.position.z = MathUtils.clamp(camera.position.z, -city.bounds.depth / 2, city.bounds.depth / 2);
    camera.position.y = 1.75;
  });
  return <PointerLockControls makeDefault />;
}

function PhotoCapture({ city }: { city: CityModel }) {
  const version = useCityStore((state) => state.photoVersion);
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    if (!version) return;
    const frame = requestAnimationFrame(() => gl.domElement.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `${city.repository.name}-copilot-city.png`; link.click();
      URL.revokeObjectURL(url);
    }, "image/png"));
    return () => cancelAnimationFrame(frame);
  }, [city.repository.name, gl, version]);
  return null;
}

function RendererSettings({ night }: { night: boolean }) {
  const gl = useThree((state) => state.gl);
  useEffect(() => { gl.toneMappingExposure = night ? 0.82 : 1.06; }, [gl, night]);
  return null;
}

function CityPostProcessing({ highQuality }: { highQuality: boolean }) {
  return <EffectComposer multisampling={highQuality ? 4 : 0} enableNormalPass>
    <N8AO halfRes aoRadius={highQuality ? 3.5 : 2.2} distanceFalloff={0.8} intensity={highQuality ? 2.2 : 1.4} quality={highQuality ? "medium" : "performance"} color="#16201d" />
    <Bloom mipmapBlur luminanceThreshold={0.72} luminanceSmoothing={0.3} intensity={highQuality ? 0.48 : 0.25} />
    <Vignette eskil={false} offset={0.24} darkness={0.34} />
  </EffectComposer>;
}

export function CityScene({ city, preview = false }: { city: CityModel; preview?: boolean }) {
  const selectBuilding = useCityStore((state) => state.selectBuilding);
  const viewMode = useCityStore((state) => state.viewMode);
  const visualMode = useCityStore((state) => state.visualMode);
  const quality = useCityStore((state) => state.quality);
  const controls = useRef<OrbitControlsImpl>(null);
  const [adaptiveHigh, setAdaptiveHigh] = useState(false);
  const maxDistance = Math.max(48, city.bounds.radius * 2.4);
  const highQuality = quality === "high" || (quality === "auto" && adaptiveHigh);
  const night = visualMode === "night";

  return <Canvas
    key={city.repository.fullName}
    shadows
    dpr={highQuality ? [1, 1.6] : [0.75, 1.15]}
    camera={{ position: [24, 18, 26], fov: 42, near: 0.1, far: 240 }}
    gl={{ antialias: false, powerPreference: "high-performance", preserveDrawingBuffer: true }}
    onCreated={({ gl }) => { gl.shadowMap.type = PCFSoftShadowMap; gl.domElement.id = "city-viewport"; gl.toneMapping = ACESFilmicToneMapping; gl.toneMappingExposure = night ? 0.82 : 1.06; gl.outputColorSpace = SRGBColorSpace; }}
    onPointerMissed={() => selectBuilding(null)}
  >
    <color attach="background" args={[night ? "#071514" : "#78918c"]} />
    <fog attach="fog" args={[night ? "#071514" : "#78918c", maxDistance * 0.72, maxDistance * 2.25]} />
    <Suspense fallback={<SceneLoader />}>
      <CameraSetup city={city} viewMode={viewMode} />
      <CityLighting bounds={city.bounds} />
      <CityWorld city={city} />
      <RendererSettings night={night} />
      <PhotoCapture city={city} />
      {viewMode === "map" ? <>
        <FocusCamera city={city} controls={controls} />
        <CinematicCamera city={city} controls={controls} />
        <OrbitControls ref={controls} makeDefault target={[0, 2.5, 0]} autoRotate={preview} autoRotateSpeed={0.28} enableDamping dampingFactor={0.075} minDistance={6} maxDistance={maxDistance} minPolarAngle={0.34} maxPolarAngle={Math.PI / 2.06} screenSpacePanning={false} regress />
      </> : <ExploreMovement city={city} />}
      <CityPostProcessing highQuality={highQuality} />
      <PerformanceMonitor flipflops={3} onIncline={() => setAdaptiveHigh(true)} onDecline={() => setAdaptiveHigh(false)} />
      <AdaptiveDpr pixelated={false} />
    </Suspense>
  </Canvas>;
}
