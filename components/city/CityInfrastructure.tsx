"use client";

import { Clone, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type RefObject, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  Euler,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import { useCityStore } from "@/store/city-store";
import type { CityModel, CityRoad, Position3D } from "@/types/city";

function seeded(index: number, salt = 0) {
  const value = Math.sin(index * 128.31 + 78.233 + salt * 41.79) * 43758.5453;
  return value - Math.floor(value);
}

function distanceToRoad(x: number, z: number, road: CityRoad) {
  const dx = road.to[0] - road.from[0];
  const dz = road.to[1] - road.from[1];
  const lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared
    ? Math.max(0, Math.min(1, ((x - road.from[0]) * dx + (z - road.from[1]) * dz) / lengthSquared))
    : 0;
  return Math.hypot(x - (road.from[0] + dx * t), z - (road.from[1] + dz * t));
}

interface InstanceTransform {
  position: Position3D;
  scale?: Position3D;
  rotation?: Position3D;
}

function useInstanceTransforms(ref: RefObject<InstancedMesh | null>, transforms: InstanceTransform[]) {
  useLayoutEffect(() => {
    if (!ref.current) return;
    const dummy = new Object3D();
    transforms.forEach((item, index) => {
      dummy.position.set(...item.position);
      dummy.rotation.set(...(item.rotation ?? [0, 0, 0]));
      dummy.scale.set(...(item.scale ?? [1, 1, 1]));
      dummy.updateMatrix();
      ref.current?.setMatrixAt(index, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [ref, transforms]);
}

function transformed(
  geometry: BufferGeometry,
  position: Position3D,
  scale: Position3D,
  rotation: Position3D = [0, 0, 0],
) {
  const matrix = new Matrix4().compose(
    new Vector3(...position),
    new Quaternion().setFromEuler(new Euler(...rotation)),
    new Vector3(...scale),
  );
  return geometry.clone().applyMatrix4(matrix);
}

function merged(parts: BufferGeometry[]) {
  const compatible = parts.map((part) => (part.index ? part.toNonIndexed() : part));
  const geometry = mergeGeometries(compatible, false) ?? new BufferGeometry();
  compatible.forEach((part, index) => {
    if (part !== parts[index]) part.dispose();
  });
  parts.forEach((part) => part.dispose());
  geometry.computeBoundingSphere();
  return geometry;
}

function vertexTint(geometry: BufferGeometry, color: string) {
  const value = new Color(color);
  const colors = new Float32Array(geometry.getAttribute("position").count * 3);
  for (let index = 0; index < colors.length; index += 3) {
    colors[index] = value.r;
    colors[index + 1] = value.g;
    colors[index + 2] = value.b;
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return geometry;
}

const TREE_MODEL = "/assets/city/nature/tree.glb";

interface TreeSpot {
  position: Position3D;
  rotation: number;
  size: number;
}

/**
 * The authored tree is one mesh, so all trees can share one geometry, material and draw.
 * Previously every planting mounted a full <Clone>, which made the prettiest revision of
 * the city its slowest one. Per-instance colour and non-uniform scale keep the rows from
 * reading as stamped copies.
 */
function InstancedKitTrees({ trees }: { trees: TreeSpot[] }) {
  const gltf = useGLTF(TREE_MODEL, false, true);
  const quality = useCityStore((state) => state.quality);
  const ref = useRef<InstancedMesh>(null);
  const asset = useMemo(() => {
    gltf.scene.updateMatrixWorld(true);
    let source: Mesh | null = null;
    gltf.scene.traverse((object) => {
      if (!source && object instanceof Mesh) source = object;
    });
    if (!source) return null;
    const mesh = source as Mesh;
    const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox?.clone() ?? new Box3();
    const size = box.getSize(new Vector3());
    const material = Array.isArray(mesh.material) ? mesh.material[0].clone() : mesh.material.clone();
    if ("roughness" in material) material.roughness = 0.92;
    if ("metalness" in material) material.metalness = 0;
    return { geometry, material, box, footprint: Math.max(size.x, size.z) || 1 };
  }, [gltf]);

  useLayoutEffect(() => {
    if (!asset || !ref.current) return;
    const dummy = new Object3D();
    const palette = ["#73866a", "#687c61", "#7f8e6c", "#61755e"];
    trees.forEach((tree, index) => {
      const scale = tree.size / asset.footprint;
      const broadleaf = index % 5 !== 0;
      dummy.position.set(tree.position[0], tree.position[1] - asset.box.min.y * scale, tree.position[2]);
      dummy.rotation.set(0, tree.rotation, 0);
      dummy.scale.set(
        scale * (broadleaf ? 1.12 : 0.82),
        scale * (broadleaf ? 0.86 : 1.08),
        scale * (broadleaf ? 1.06 : 0.82),
      );
      dummy.updateMatrix();
      ref.current?.setMatrixAt(index, dummy.matrix);
      ref.current?.setColorAt(index, new Color(palette[index % palette.length]));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [asset, trees]);

  useEffect(
    () => () => {
      asset?.geometry.dispose();
      asset?.material.dispose();
    },
    [asset],
  );

  if (!asset) return null;
  return (
    <instancedMesh
      name="trees:kit"
      ref={ref}
      args={[asset.geometry, asset.material, trees.length]}
      castShadow={quality === "high"}
      receiveShadow
    />
  );
}

function UrbanForest({ city }: { city: CityModel }) {
  const trees = useMemo(() => {
    const spots: TreeSpot[] = [];
    const clearOfCity = (x: number, z: number) =>
      city.buildings.every((b) => Math.hypot(x - b.position[0], z - b.position[2]) > 2) &&
      city.roads.every((road) => distanceToRoad(x, z, road) > road.width / 2 + 0.7);

    city.districts.forEach((district, districtIndex) => {
      // A ring of park trees around each plaza — the one place a planting reads as deliberate.
      for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * Math.PI * 2 + districtIndex;
        const radius = 1.7 + seeded(districtIndex * 7 + i, 2) * 0.5;
        const x = district.plazaPosition[0] + Math.cos(angle) * radius;
        const z = district.plazaPosition[1] + Math.sin(angle) * radius;
        if (clearOfCity(x, z))
          spots.push({
            position: [x, 0.02, z],
            rotation: seeded(districtIndex * 13 + i, 5) * Math.PI * 2,
            size: 1.5 + seeded(districtIndex * 3 + i, 9) * 0.5,
          });
      }
      // A few along the district's front edge, evenly spaced, like a street planting.
      const [cx, cz] = district.position;
      const [w, d] = district.size;
      for (let i = 0; i < 4; i += 1) {
        const along = (i / 3 - 0.5) * w * 0.82;
        const x = cx + along;
        const z = cz + d * 0.46;
        if (clearOfCity(x, z))
          spots.push({
            position: [x, 0.02, z],
            rotation: seeded(districtIndex * 17 + i, 6) * Math.PI * 2,
            size: 1.5 + seeded(districtIndex * 5 + i, 4) * 0.45,
          });
      }
    });
    return spots.slice(0, 64);
  }, [city.buildings, city.districts, city.roads]);

  return <InstancedKitTrees trees={trees} />;
}

type VehicleKind = "sedan" | "suv" | "taxi" | "van" | "bus";

interface TrafficUnit {
  road: CityRoad;
  lane: number;
  nx: number;
  nz: number;
  offset: number;
  speed: number;
  color: Color;
  scale: Position3D;
}

function vehicleGeometry(kind: VehicleKind) {
  const sizes = {
    sedan: { width: 0.62, length: 1.28, body: 0.2, cabin: 0.42 },
    suv: { width: 0.68, length: 1.34, body: 0.26, cabin: 0.5 },
    taxi: { width: 0.62, length: 1.28, body: 0.2, cabin: 0.42 },
    van: { width: 0.72, length: 1.48, body: 0.3, cabin: 0.56 },
    bus: { width: 0.78, length: 2.08, body: 0.42, cabin: 0.68 },
  }[kind];
  const bodyParts = [
    transformed(
      new RoundedBoxGeometry(1, 1, 1, 1, 0.12),
      [0, sizes.body / 2 + 0.17, 0],
      [sizes.width, sizes.body, sizes.length],
    ),
    transformed(
      new RoundedBoxGeometry(1, 1, 1, 1, 0.1),
      [0, sizes.body + 0.2, sizes.length * 0.28],
      [sizes.width * 0.92, 0.12, sizes.length * 0.24],
    ),
  ];
  if (kind === "taxi") bodyParts.push(transformed(new BoxGeometry(), [0, 0.58, 0], [0.22, 0.08, 0.13]));
  let cabin = transformed(
    new CylinderGeometry(0.68, 1, 1, 4).rotateY(Math.PI / 4),
    [0, sizes.body + sizes.cabin / 2 + 0.12, -sizes.length * 0.08],
    [sizes.width * 0.74, sizes.cabin, sizes.length * (kind === "van" || kind === "bus" ? 0.52 : 0.42)],
  );
  if (kind === "bus") {
    const sideWindows: BufferGeometry[] = [cabin];
    for (const side of [-1, 1])
      for (let window = -2; window <= 2; window += 1)
        sideWindows.push(
          transformed(
            new RoundedBoxGeometry(1, 1, 1, 1, 0.08),
            [side * sizes.width * 0.48, 0.72, window * 0.31],
            [0.035, 0.3, 0.23],
          ),
        );
    cabin = merged(sideWindows);
  }
  const wheelParts: BufferGeometry[] = [];
  const wheel = new CylinderGeometry(0.13, 0.13, 0.075, 12).rotateZ(Math.PI / 2);
  for (const x of [-sizes.width * 0.53, sizes.width * 0.53])
    for (const z of [-sizes.length * 0.31, sizes.length * 0.31])
      wheelParts.push(transformed(wheel, [x, 0.16, z], [1, 1, 1]));
  wheel.dispose();
  const headlights = merged([
    transformed(new BoxGeometry(), [-sizes.width * 0.27, 0.27, sizes.length * 0.505], [0.13, 0.075, 0.035]),
    transformed(new BoxGeometry(), [sizes.width * 0.27, 0.27, sizes.length * 0.505], [0.13, 0.075, 0.035]),
  ]);
  const taillights = merged([
    transformed(new BoxGeometry(), [-sizes.width * 0.27, 0.27, -sizes.length * 0.505], [0.13, 0.075, 0.035]),
    transformed(new BoxGeometry(), [sizes.width * 0.27, 0.27, -sizes.length * 0.505], [0.13, 0.075, 0.035]),
  ]);
  const shell = merged([
    vertexTint(merged(bodyParts), "#ffffff"),
    vertexTint(cabin, "#285564"),
    vertexTint(merged(wheelParts), "#1a1d1e"),
  ]);
  const lights = merged([vertexTint(headlights, "#fff3c9"), vertexTint(taillights, "#ed302a")]);
  return { shell, lights };
}

function VehicleFleet({ kind, units }: { kind: VehicleKind; units: TrafficUnit[] }) {
  const shell = useRef<InstancedMesh>(null);
  const lights = useRef<InstancedMesh>(null);
  const lastUpdate = useRef(0);
  const dummy = useMemo(() => new Object3D(), []);
  const geometry = useMemo(() => vehicleGeometry(kind), [kind]);
  useLayoutEffect(() => {
    if (!shell.current) return;
    units.forEach((unit, index) => shell.current?.setColorAt(index, unit.color));
    if (shell.current.instanceColor) shell.current.instanceColor.needsUpdate = true;
  }, [units]);
  useFrame(({ clock }) => {
    if (!shell.current || !lights.current) return;
    if (clock.elapsedTime - lastUpdate.current < 1 / 24) return;
    lastUpdate.current = clock.elapsedTime;
    units.forEach((unit, index) => {
      const raw = (clock.elapsedTime * unit.speed + unit.offset) % 1;
      // Ride the middle 84% of the segment so cars never sit on the intersection nodes,
      // which is what read as a pile-up where roads meet.
      const eased = 0.08 + raw * 0.84;
      const progress = unit.lane > 0 ? eased : 1 - eased;
      const dx = unit.road.to[0] - unit.road.from[0];
      const dz = unit.road.to[1] - unit.road.from[1];
      const laneOffset = unit.lane * unit.road.width * 0.24;
      const x = unit.road.from[0] + dx * progress + unit.nx * laneOffset;
      const z = unit.road.from[1] + dz * progress + unit.nz * laneOffset;
      const y = unit.road.kind === "bridge" ? 0.71 : 0.13;
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, Math.atan2(dx * unit.lane, dz * unit.lane), 0);
      const roadScale = unit.road.kind === "avenue" ? 1 : 0.92;
      dummy.scale.set(unit.scale[0] * roadScale, unit.scale[1] * roadScale, unit.scale[2] * roadScale);
      dummy.updateMatrix();
      shell.current?.setMatrixAt(index, dummy.matrix);
      lights.current?.setMatrixAt(index, dummy.matrix);
    });
    for (const ref of [shell, lights]) ref.current!.instanceMatrix.needsUpdate = true;
  });
  useEffect(() => () => Object.values(geometry).forEach((item) => item.dispose()), [geometry]);
  return (
    <group>
      <instancedMesh
        ref={shell}
        args={[geometry.shell, undefined, units.length]}
        frustumCulled={false}
        castShadow
      >
        <meshPhysicalMaterial
          vertexColors
          roughness={0.3}
          metalness={0.46}
          clearcoat={0.82}
          clearcoatRoughness={0.18}
        />
      </instancedMesh>
      <instancedMesh ref={lights} args={[geometry.lights, undefined, units.length]} frustumCulled={false}>
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

const VEHICLE_MODELS: Record<Exclude<VehicleKind, "bus">, string> = {
  sedan: "/assets/city/vehicles/sedan.glb",
  suv: "/assets/city/vehicles/suv.glb",
  taxi: "/assets/city/vehicles/taxi.glb",
  van: "/assets/city/vehicles/van.glb",
};

/**
 * Normalisation for one car model: how to scale/lift/rotate its cloned scene so it sits on
 * the road as a real ~1.5-unit car facing +Z. Computed once per model.
 */
function useCarNormalisation(url: string) {
  const gltf = useGLTF(url, false, true);
  return useMemo(() => {
    gltf.scene.updateMatrixWorld(true);
    const box = new Box3().setFromObject(gltf.scene);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const modelLength = Math.max(size.x, size.z) || 1;
    return {
      scale: 1.5 / modelLength,
      dy: -box.min.y * (1.5 / modelLength),
      dx: -center.x * (1.5 / modelLength),
      dz: -center.z * (1.5 / modelLength),
      swap: size.x > size.z,
    };
  }, [gltf]);
}

/**
 * Authored CC0 cars animated along their roads. The model transform is baked once and every
 * vehicle of one type shares a single instanced draw, including deterministic paint tint.
 */
function MovingCarFleet({ url, units }: { url: string; units: TrafficUnit[] }) {
  const gltf = useGLTF(url, false, true);
  const norm = useCarNormalisation(url);
  const ref = useRef<InstancedMesh>(null);
  const asset = useMemo(() => {
    gltf.scene.updateMatrixWorld(true);
    let source: Mesh | null = null;
    gltf.scene.traverse((object) => {
      if (!source && object instanceof Mesh) source = object;
    });
    if (!source) return null;
    const mesh = source as Mesh;
    const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    const material = Array.isArray(mesh.material) ? mesh.material[0].clone() : mesh.material.clone();
    if ("roughness" in material) material.roughness = 0.48;
    return { geometry, material };
  }, [gltf]);

  useLayoutEffect(() => {
    if (!ref.current) return;
    units.forEach((unit, index) => ref.current?.setColorAt(index, unit.color));
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [units]);

  useFrame(({ clock }) => {
    if (!ref.current || !asset) return;
    const base = new Matrix4();
    const normal = new Matrix4().compose(
      new Vector3(norm.dx, norm.dy, norm.dz),
      new Quaternion(),
      new Vector3(norm.scale, norm.scale, norm.scale),
    );
    const dummy = new Object3D();
    units.forEach((unit, index) => {
      const raw = (clock.elapsedTime * unit.speed + unit.offset) % 1;
      const eased = 0.08 + raw * 0.84;
      const progress = unit.lane > 0 ? eased : 1 - eased;
      const dx = unit.road.to[0] - unit.road.from[0];
      const dz = unit.road.to[1] - unit.road.from[1];
      const laneOffset = unit.lane * unit.road.width * 0.24;
      dummy.position.set(
        unit.road.from[0] + dx * progress + unit.nx * laneOffset,
        unit.road.kind === "bridge" ? 0.6 : 0.03,
        unit.road.from[1] + dz * progress + unit.nz * laneOffset,
      );
      dummy.rotation.set(0, Math.atan2(dx * unit.lane, dz * unit.lane) + (norm.swap ? Math.PI / 2 : 0), 0);
      dummy.scale.set(...unit.scale);
      dummy.updateMatrix();
      base.multiplyMatrices(dummy.matrix, normal);
      ref.current?.setMatrixAt(index, base);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });

  useEffect(
    () => () => {
      asset?.geometry.dispose();
      asset?.material.dispose();
    },
    [asset],
  );

  if (!asset || !units.length) return null;
  return (
    <instancedMesh
      name={`vehicles:${url.split("/").pop()?.replace(".glb", "") ?? "car"}`}
      ref={ref}
      args={[asset.geometry, asset.material, units.length]}
      frustumCulled={false}
      castShadow={false}
      receiveShadow
    />
  );
}

function DataTraffic({ city }: { city: CityModel }) {
  const fleets = useMemo(() => {
    const output: Record<VehicleKind, TrafficUnit[]> = {
      sedan: [],
      suv: [],
      taxi: [],
      van: [],
      bus: [],
    };
    const palette = ["#23323b", "#8b3f36", "#d7d0bd", "#3d5650", "#2b2d31", "#b5a16d"];

    // Only real streets and avenues carry cars, longest first, so traffic spreads across the
    // whole city instead of piling onto whichever segments happened to come first.
    const drivable = city.roads
      .map((road, roadIndex) => {
        const dx = road.to[0] - road.from[0];
        const dz = road.to[1] - road.from[1];
        return { road, roadIndex, dx, dz, length: Math.hypot(dx, dz) };
      })
      .filter((entry) => entry.length > 3)
      .sort((a, b) => b.length - a.length)
      .slice(0, 40);

    let placed = 0;
    for (const { road, roadIndex, dx, dz, length } of drivable) {
      if (placed >= 120) break;
      // One car per ~7 units of lane, split across two directions.
      const perLane = Math.max(1, Math.min(3, Math.round(length / 7)));
      // Every car on a road shares one speed, so even spacing stays even forever — the
      // per-car random speed was letting cars catch up and overlap.
      const speed = (0.05 + seeded(roadIndex, 5) * 0.03) / Math.max(6, length);
      const kind: VehicleKind =
        roadIndex % 19 === 0
          ? "bus"
          : roadIndex % 9 === 0
            ? "van"
            : roadIndex % 5 === 0
              ? "taxi"
              : roadIndex % 2 === 0
                ? "suv"
                : "sedan";
      for (const lane of [1, -1]) {
        for (let slot = 0; slot < perLane; slot += 1) {
          if (placed >= 120) break;
          const unitKind = lane < 0 && slot === 0 && kind !== "bus" ? "sedan" : kind;
          output[unitKind].push({
            road,
            nx: -dz / length,
            nz: dx / length,
            lane,
            // Evenly phased within the lane, offset half a slot between the two directions.
            offset: (slot + (lane < 0 ? 0.5 : 0)) / perLane,
            speed,
            color: new Color(unitKind === "taxi" ? "#d6a91c" : palette[(roadIndex + slot) % palette.length]),
            scale: (() => {
              const jitter = 0.94 + seeded(roadIndex * 29 + slot, 6) * 0.12;
              return [jitter, jitter, jitter] as Position3D;
            })(),
          });
          placed += 1;
        }
      }
    }
    return output;
  }, [city.roads]);
  // Keep a legible amount of map traffic while respecting the visible-triangle budget; the
  // bus (no GLB) remains a separate procedural instanced fleet.
  const remaining = { value: 18 };
  const glbFleets = (["sedan", "suv", "taxi", "van"] as const).map((kind) => {
    const units = fleets[kind].slice(0, remaining.value);
    remaining.value -= units.length;
    return { kind, units };
  });
  return (
    <group>
      {glbFleets.map(({ kind, units }) => (
        <MovingCarFleet key={kind} url={VEHICLE_MODELS[kind]} units={units} />
      ))}
      {fleets.bus.length ? <VehicleFleet kind="bus" units={fleets.bus} /> : null}
    </group>
  );
}

const HERO_VEHICLES = [
  "/assets/city/vehicles/sedan.glb",
  "/assets/city/vehicles/suv.glb",
  "/assets/city/vehicles/taxi.glb",
  "/assets/city/vehicles/van.glb",
] as const;

function HeroVehicle({
  url,
  road,
  offset,
}: {
  url: (typeof HERO_VEHICLES)[number];
  road: CityRoad;
  offset: number;
}) {
  // Meshopt ships with Drei; disabling Draco here guarantees no decoder CDN is ever touched.
  const model = useGLTF(url, false, true);
  const dx = road.to[0] - road.from[0];
  const dz = road.to[1] - road.from[1];
  const length = Math.max(0.001, Math.hypot(dx, dz));
  const lane = offset % 2 === 0 ? 1 : -1;
  const progress = 0.22 + offset * 0.17;
  const lateral = lane * road.width * 0.24;
  const position: Position3D = [
    road.from[0] + dx * progress - (dz / length) * lateral,
    road.kind === "bridge" ? 0.7 : 0.14,
    road.from[1] + dz * progress + (dx / length) * lateral,
  ];

  return (
    <Clone
      object={model.scene}
      position={position}
      rotation={[0, Math.atan2(dx * lane, dz * lane), 0]}
      scale={0.43}
      castShadow
      receiveShadow
    />
  );
}

/**
 * A few authored CC0 cars anchor street-level inspection. The moving city-scale fleet stays
 * instanced; these richer meshes are mounted only in Explore so they never tax the map view.
 */
function HeroVehicles({ city }: { city: CityModel }) {
  return (
    <group>
      {HERO_VEHICLES.map((url, index) => {
        const road = city.roads[index * 2];
        return road ? <HeroVehicle key={url} url={url} road={road} offset={index} /> : null;
      })}
    </group>
  );
}

HERO_VEHICLES.forEach((url) => useGLTF.preload(url, false, true));
useGLTF.preload(TREE_MODEL);

function StreetFurniture({ city }: { city: CityModel }) {
  const posts = useRef<InstancedMesh>(null);
  const arms = useRef<InstancedMesh>(null);
  const lamps = useRef<InstancedMesh>(null);
  const pools = useRef<InstancedMesh>(null);
  const planters = useRef<InstancedMesh>(null);
  const benches = useRef<InstancedMesh>(null);
  const signalPosts = useRef<InstancedMesh>(null);
  const signalHeads = useRef<InstancedMesh>(null);
  const signalLights = useRef<InstancedMesh>(null);
  const lampGeometry = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 1, 0.16), []);
  const planterGeometry = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 1, 0.12), []);
  const night = useCityStore((state) => state.visualMode) === "night";
  const positions = useMemo(
    () =>
      city.roads
        .flatMap((road, roadIndex) => {
          const dx = road.to[0] - road.from[0];
          const dz = road.to[1] - road.from[1];
          const length = Math.max(0.001, Math.hypot(dx, dz));
          const nx = -dz / length;
          const nz = dx / length;
          const count = Math.min(7, Math.max(2, Math.floor(length / 4.5)));
          return Array.from({ length: count }, (_, index) => {
            const progress = (index + 0.5) / count;
            const side = (index + roadIndex) % 2 ? 1 : -1;
            return {
              position: [
                road.from[0] + dx * progress + nx * side * (road.width / 2 + 0.38),
                0.12,
                road.from[1] + dz * progress + nz * side * (road.width / 2 + 0.38),
              ] as Position3D,
              heading: Math.atan2(dx, dz),
              side,
            };
          });
        })
        .filter((_, index) => index % 3 === 0),
    [city.roads],
  );
  const postTransforms = useMemo(
    () =>
      positions.map(({ position: [x, , z] }) => ({
        position: [x, 0.78, z] as Position3D,
        scale: [0.035, 1.32, 0.035] as Position3D,
      })),
    [positions],
  );
  const armTransforms = useMemo(
    () =>
      positions.map(({ position: [x, , z], heading, side }) => ({
        position: [
          x + Math.cos(heading) * side * 0.16,
          1.43,
          z - Math.sin(heading) * side * 0.16,
        ] as Position3D,
        scale: [0.035, 0.035, 0.42] as Position3D,
        rotation: [0, heading + (side * Math.PI) / 2, 0] as Position3D,
      })),
    [positions],
  );
  const lampTransforms = useMemo(
    () =>
      positions.map(({ position: [x, , z], heading, side }) => ({
        position: [
          x + Math.cos(heading) * side * 0.33,
          1.39,
          z - Math.sin(heading) * side * 0.33,
        ] as Position3D,
        scale: [0.14, 0.055, 0.22] as Position3D,
        rotation: [0, heading, 0] as Position3D,
      })),
    [positions],
  );
  const poolTransforms = useMemo(
    () =>
      positions.map(({ position: [x, , z] }) => ({
        position: [x, 0.135, z] as Position3D,
        scale: [2.4, 1, 2.4] as Position3D,
      })),
    [positions],
  );
  const planterTransforms = useMemo(
    () =>
      city.districts.map((district, index) => ({
        position: [district.plazaPosition[0] + 1.2, 0.28, district.plazaPosition[1] - 1.05] as Position3D,
        scale: [0.72 + (index % 2) * 0.15, 0.34, 0.44] as Position3D,
        rotation: [0, index * 0.7, 0] as Position3D,
      })),
    [city.districts],
  );
  const benchTransforms = useMemo(
    () =>
      city.districts.map((district, index) => ({
        position: [district.plazaPosition[0] - 1.05, 0.32, district.plazaPosition[1] + 0.95] as Position3D,
        scale: [0.9, 0.12, 0.32] as Position3D,
        rotation: [0, index * 0.7 + Math.PI / 2, 0] as Position3D,
      })),
    [city.districts],
  );
  const signalTransforms = useMemo(
    () =>
      city.roads
        .filter((road) => road.kind === "avenue")
        .slice(0, 18)
        .map((road, index) => {
          const dx = road.to[0] - road.from[0];
          const dz = road.to[1] - road.from[1];
          const length = Math.max(0.001, Math.hypot(dx, dz));
          const end = index % 2 ? road.from : road.to;
          return {
            position: [
              end[0] - (dz / length) * (road.width / 2 + 0.22),
              0.86,
              end[1] + (dx / length) * (road.width / 2 + 0.22),
            ] as Position3D,
            rotation: [0, Math.atan2(dx, dz), 0] as Position3D,
          };
        }),
    [city.roads],
  );
  const signalHeadTransforms = useMemo(
    () =>
      signalTransforms.map((item) => ({
        ...item,
        position: [item.position[0], 1.52, item.position[2]] as Position3D,
        scale: [0.16, 0.36, 0.12] as Position3D,
      })),
    [signalTransforms],
  );
  const signalLightTransforms = useMemo(
    () =>
      signalTransforms.flatMap((item) =>
        [-0.16, 0, 0.16].map((offset) => ({
          ...item,
          position: [item.position[0], 1.52 + offset, item.position[2] + 0.125] as Position3D,
          scale: [0.07, 0.07, 0.035] as Position3D,
        })),
      ),
    [signalTransforms],
  );
  useInstanceTransforms(posts, postTransforms);
  useInstanceTransforms(arms, armTransforms);
  useInstanceTransforms(lamps, lampTransforms);
  useInstanceTransforms(pools, poolTransforms);
  useInstanceTransforms(planters, planterTransforms);
  useInstanceTransforms(benches, benchTransforms);
  useInstanceTransforms(
    signalPosts,
    signalTransforms.map((item) => ({ ...item, scale: [0.035, 1.45, 0.035] as Position3D })),
  );
  useInstanceTransforms(signalHeads, signalHeadTransforms);
  useInstanceTransforms(signalLights, signalLightTransforms);
  const poolGeometry = useMemo(() => new CircleGeometry(0.5, 18).rotateX(-Math.PI / 2), []);
  const poolMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#ffc978", transparent: true, opacity: 0.18, depthWrite: false }),
    [],
  );
  useEffect(
    () => () => {
      poolGeometry.dispose();
      poolMaterial.dispose();
      lampGeometry.dispose();
      planterGeometry.dispose();
    },
    [lampGeometry, planterGeometry, poolGeometry, poolMaterial],
  );
  return (
    <group>
      <instancedMesh ref={posts} args={[undefined, undefined, positions.length]} castShadow>
        <cylinderGeometry args={[1, 1.08, 1, 8]} />
        <meshStandardMaterial color="#34413f" roughness={0.42} metalness={0.58} />
      </instancedMesh>
      <instancedMesh ref={arms} args={[undefined, undefined, positions.length]}>
        <boxGeometry />
        <meshStandardMaterial color="#34413f" roughness={0.42} metalness={0.58} />
      </instancedMesh>
      <instancedMesh ref={lamps} args={[lampGeometry, undefined, positions.length]}>
        <meshStandardMaterial color="#ffe8b2" emissive="#ffc66b" emissiveIntensity={night ? 2.2 : 0} />
      </instancedMesh>
      <instancedMesh
        ref={pools}
        args={[poolGeometry, poolMaterial, positions.length]}
        visible={night}
        frustumCulled={false}
      />
      <instancedMesh
        ref={planters}
        args={[planterGeometry, undefined, planterTransforms.length]}
        receiveShadow
      >
        <meshStandardMaterial color="#98785f" roughness={0.92} />
      </instancedMesh>
      <instancedMesh ref={benches} args={[undefined, undefined, benchTransforms.length]} castShadow>
        <boxGeometry />
        <meshStandardMaterial color="#76513b" roughness={0.8} metalness={0.08} />
      </instancedMesh>
      <instancedMesh ref={signalPosts} args={[undefined, undefined, signalTransforms.length]} castShadow>
        <cylinderGeometry args={[1, 1, 1, 8]} />
        <meshStandardMaterial color="#293331" roughness={0.48} metalness={0.52} />
      </instancedMesh>
      <instancedMesh ref={signalHeads} args={[undefined, undefined, signalHeadTransforms.length]}>
        <boxGeometry />
        <meshStandardMaterial color="#1c2524" roughness={0.5} metalness={0.38} />
      </instancedMesh>
      <instancedMesh ref={signalLights} args={[undefined, undefined, signalLightTransforms.length]}>
        <sphereGeometry args={[1, 9, 7]} />
        <meshStandardMaterial color="#d9a72c" emissive="#d9a72c" emissiveIntensity={night ? 1.4 : 0.25} />
      </instancedMesh>
    </group>
  );
}

export function CityInfrastructure({ city }: { city: CityModel }) {
  const viewMode = useCityStore((state) => state.viewMode);
  return (
    <group>
      <UrbanForest city={city} />
      <StreetFurniture city={city} />
      <DataTraffic city={city} />
      {viewMode === "explore" && <HeroVehicles city={city} />}
    </group>
  );
}
