"use client";

import { Clone, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type RefObject, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  Float32BufferAttribute,
  InstancedMesh,
  IcosahedronGeometry,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
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

/** Flat-roofed infill homes establish Mexican street scale without becoming semantic files. */
function NeighborhoodFabric({ city }: { city: CityModel }) {
  const bodies = useRef<InstancedMesh>(null);
  const trims = useRef<InstancedMesh>(null);
  const windows = useRef<InstancedMesh>(null);
  const awnings = useRef<InstancedMesh>(null);
  const tanks = useRef<InstancedMesh>(null);
  const bodyGeometry = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 1, 0.045), []);
  const lots = useMemo(
    () =>
      city.districts.flatMap((district, districtIndex) => {
        const [cx, cz] = district.position;
        const [w, d] = district.size;
        const candidates: Position3D[] = [
          [cx - w * 0.38, 0.12, cz - d * 0.34],
          [cx + w * 0.38, 0.12, cz - d * 0.34],
          [cx - w * 0.38, 0.12, cz + d * 0.34],
          [cx + w * 0.38, 0.12, cz + d * 0.34],
          [cx - w * 0.24, 0.12, cz - d * 0.39],
          [cx + w * 0.24, 0.12, cz + d * 0.39],
        ];
        return candidates
          .filter(([x, , z]) => {
            const awayFromFiles = city.buildings.every(
              (building) => Math.hypot(x - building.position[0], z - building.position[2]) > 3.2,
            );
            const awayFromPlaza =
              Math.hypot(x - district.plazaPosition[0], z - district.plazaPosition[1]) > 2.8;
            const awayFromRoads = city.roads.every(
              (road) => distanceToRoad(x, z, road) > road.width / 2 + 1.25,
            );
            return awayFromFiles && awayFromPlaza && awayFromRoads;
          })
          .slice(0, 3 + (districtIndex % 2))
          .map((position, localIndex) => ({ position, seed: districtIndex * 11 + localIndex }));
      }),
    [city.buildings, city.districts, city.roads],
  );
  const bodyTransforms = useMemo(
    () =>
      lots.map(({ position: [x, , z], seed }) => ({
        position: [x, 0.64 + (seed % 3) * 0.12, z] as Position3D,
        scale: [1.5 + (seed % 2) * 0.34, 1.02 + (seed % 3) * 0.24, 1.16] as Position3D,
        rotation: [0, (seed % 4) * (Math.PI / 2), 0] as Position3D,
      })),
    [lots],
  );
  const trimTransforms = useMemo(
    () =>
      bodyTransforms.map((item) => ({
        ...item,
        position: [item.position[0], item.position[1] * 2 + 0.06, item.position[2]] as Position3D,
        scale: [item.scale![0] * 1.04, 0.1, item.scale![2] * 1.04] as Position3D,
      })),
    [bodyTransforms],
  );
  const windowTransforms = useMemo(
    () =>
      bodyTransforms.map((item) => ({
        position: [
          item.position[0],
          item.position[1] * 0.95,
          item.position[2] + item.scale![2] * 0.505,
        ] as Position3D,
        scale: [item.scale![0] * 0.58, item.scale![1] * 0.35, 0.035] as Position3D,
        rotation: item.rotation,
      })),
    [bodyTransforms],
  );
  const awningTransforms = useMemo(
    () =>
      bodyTransforms.map((item) => ({
        position: [
          item.position[0],
          item.position[1] * 1.32,
          item.position[2] + item.scale![2] * 0.64,
        ] as Position3D,
        scale: [item.scale![0] * 0.68, 0.08, 0.42] as Position3D,
        rotation: [0, item.rotation![1], -0.08] as Position3D,
      })),
    [bodyTransforms],
  );
  const tankTransforms = useMemo(
    () =>
      bodyTransforms.map((item, index) => ({
        position: [
          item.position[0] + 0.28,
          item.position[1] * 2 + 0.38,
          item.position[2] - 0.2,
        ] as Position3D,
        scale: [0.22 + (index % 2) * 0.03, 0.42, 0.22 + (index % 2) * 0.03] as Position3D,
      })),
    [bodyTransforms],
  );
  useInstanceTransforms(bodies, bodyTransforms);
  useInstanceTransforms(trims, trimTransforms);
  useInstanceTransforms(windows, windowTransforms);
  useInstanceTransforms(awnings, awningTransforms);
  useInstanceTransforms(tanks, tankTransforms);
  useEffect(() => () => bodyGeometry.dispose(), [bodyGeometry]);

  return (
    <group>
      <instancedMesh ref={bodies} args={[bodyGeometry, undefined, lots.length]} castShadow receiveShadow>
        <meshStandardMaterial color="#c9b38e" roughness={0.88} />
      </instancedMesh>
      <instancedMesh ref={trims} args={[undefined, undefined, lots.length]} castShadow>
        <boxGeometry />
        <meshStandardMaterial color="#eadfc9" roughness={0.78} />
      </instancedMesh>
      <instancedMesh ref={windows} args={[undefined, undefined, lots.length]}>
        <boxGeometry />
        <meshPhysicalMaterial color="#285667" roughness={0.12} metalness={0.2} clearcoat={0.8} />
      </instancedMesh>
      <instancedMesh ref={awnings} args={[undefined, undefined, lots.length]} castShadow>
        <boxGeometry />
        <meshStandardMaterial color="#915142" roughness={0.68} />
      </instancedMesh>
      <instancedMesh ref={tanks} args={[undefined, undefined, lots.length]} castShadow>
        <cylinderGeometry args={[1, 1, 1, 12]} />
        <meshStandardMaterial color="#222c2b" roughness={0.72} />
      </instancedMesh>
    </group>
  );
}

type TreeKind = "jacaranda" | "ficus" | "palm";

function treeGeometry(kind: TreeKind) {
  const trunkParts: BufferGeometry[] = [];
  const leafParts: BufferGeometry[] = [];
  const trunk = new CylinderGeometry(0.72, 1, 1, 7);
  // Several angular lobes read as real irregular foliage; an icosahedron is also almost
  // half the triangle cost of the former dodecahedron once instanced across the city.
  const leaf = new IcosahedronGeometry(1, 0);
  if (kind === "palm") {
    for (let segment = 0; segment < 4; segment += 1)
      trunkParts.push(
        transformed(
          trunk,
          [0.03 * segment, 0.42 + segment * 0.42, 0],
          [0.12 - segment * 0.012, 0.86, 0.12 - segment * 0.012],
          [0, 0, -0.04],
        ),
      );
    for (let frond = 0; frond < 9; frond += 1) {
      const angle = (frond / 9) * Math.PI * 2;
      leafParts.push(
        transformed(
          new ConeGeometry(0.28, 1.8, 5),
          [Math.sin(angle) * 0.62, 1.92, Math.cos(angle) * 0.62],
          [1, 1, 0.32],
          [Math.PI / 2.7, angle, -Math.sin(angle) * 0.2],
        ),
      );
    }
  } else {
    trunkParts.push(transformed(trunk, [0, 0.62, 0], [0.13, 1.24, 0.13]));
    for (let branch = 0; branch < 4; branch += 1) {
      const angle = (branch / 4) * Math.PI * 2 + (kind === "jacaranda" ? 0.4 : 0);
      trunkParts.push(
        transformed(
          trunk,
          [Math.sin(angle) * 0.2, 1.22, Math.cos(angle) * 0.2],
          [0.055, 0.76, 0.055],
          [Math.cos(angle) * 0.56, 0, -Math.sin(angle) * 0.56],
        ),
      );
    }
    const lobes = kind === "jacaranda" ? 5 : 4;
    for (let lobe = 0; lobe < lobes; lobe += 1) {
      const angle = (lobe / lobes) * Math.PI * 2;
      const center = lobe === 0;
      leafParts.push(
        transformed(
          leaf,
          center ? [0, 1.72, 0] : [Math.sin(angle) * 0.48, 1.62 + (lobe % 2) * 0.14, Math.cos(angle) * 0.48],
          center
            ? [0.68, kind === "jacaranda" ? 0.5 : 0.72, 0.68]
            : [0.48, kind === "jacaranda" ? 0.38 : 0.56, 0.48],
          [0, angle * 0.7, 0],
        ),
      );
    }
  }
  trunk.dispose();
  leaf.dispose();
  return { trunk: merged(trunkParts), leaves: merged(leafParts) };
}

function TreeFamily({ kind, transforms }: { kind: TreeKind; transforms: InstanceTransform[] }) {
  const trunks = useRef<InstancedMesh>(null);
  const leaves = useRef<InstancedMesh>(null);
  const quality = useCityStore((state) => state.quality);
  const geometry = useMemo(() => treeGeometry(kind), [kind]);
  const foliage = useMemo(() => {
    const material = new MeshStandardMaterial({
      color: kind === "jacaranda" ? "#776582" : kind === "palm" ? "#4f7251" : "#41634c",
      roughness: 0.94,
      envMapIntensity: 0.52,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uCityWind = { value: 0 };
      material.userData.shader = shader;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uCityWind;")
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\ntransformed.x += sin(uCityWind * .72 + position.y * 2.1 + position.z) * .018 * max(position.y, 0.);",
        );
    };
    material.customProgramCacheKey = () => "copilot-city-foliage-v1";
    return material;
  }, [kind]);
  useInstanceTransforms(trunks, transforms);
  useInstanceTransforms(leaves, transforms);
  useFrame(({ clock }) => {
    const shader = foliage.userData.shader;
    if (shader && quality !== "low") shader.uniforms.uCityWind.value = clock.elapsedTime;
  });
  useEffect(
    () => () => {
      geometry.trunk.dispose();
      geometry.leaves.dispose();
      foliage.dispose();
    },
    [foliage, geometry],
  );
  return (
    <group>
      <instancedMesh
        ref={trunks}
        args={[geometry.trunk, undefined, transforms.length]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={kind === "palm" ? "#79684f" : "#5b4939"} roughness={1} />
      </instancedMesh>
      <instancedMesh
        ref={leaves}
        args={[geometry.leaves, foliage, transforms.length]}
        castShadow={quality === "high"}
      />
    </group>
  );
}

function UrbanForest({ city }: { city: CityModel }) {
  const families = useMemo(() => {
    const output: Record<TreeKind, InstanceTransform[]> = { jacaranda: [], ficus: [], palm: [] };
    city.districts.forEach((district, districtIndex) => {
      const [cx, cz] = district.position;
      const [w, d] = district.size;
      const candidates = Array.from(
        { length: Math.max(5, Math.min(12, Math.floor((w + d) / 3))) },
        (_, index) => {
          const edge = index % 4;
          const along = -0.4 + seeded(districtIndex * 31 + index) * 0.8;
          const x = edge < 2 ? cx + (edge === 0 ? -w * 0.44 : w * 0.44) : cx + along * w;
          const z = edge >= 2 ? cz + (edge === 2 ? -d * 0.44 : d * 0.44) : cz + along * d;
          return [x, 0.12, z] as Position3D;
        },
      );
      const plaza = Array.from({ length: 4 }, (_, index) => {
        const angle = index * (Math.PI / 2) + 0.55;
        return [
          district.plazaPosition[0] + Math.cos(angle) * 1.78,
          0.12,
          district.plazaPosition[1] + Math.sin(angle) * 1.78,
        ] as Position3D;
      });
      [...candidates, ...plaza]
        .filter(([x, , z]) => city.roads.every((road) => distanceToRoad(x, z, road) > road.width / 2 + 0.52))
        .forEach((position, index) => {
          const kind: TreeKind =
            index % 9 === 0 ? "palm" : (index + districtIndex) % 3 === 0 ? "jacaranda" : "ficus";
          const scale = kind === "palm" ? 0.88 : 0.72 + seeded(index + districtIndex * 19, 4) * 0.34;
          output[kind].push({
            position,
            scale: [scale, scale, scale],
            rotation: [0, seeded(index + districtIndex * 23, 8) * Math.PI * 2, 0],
          });
        });
    });
    return output;
  }, [city.districts, city.roads]);
  return (
    <group>
      <TreeFamily kind="ficus" transforms={families.ficus} />
      <TreeFamily kind="jacaranda" transforms={families.jacaranda} />
      <TreeFamily kind="palm" transforms={families.palm} />
    </group>
  );
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
      const progress = unit.lane > 0 ? raw : 1 - raw;
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
    city.roads
      .flatMap((road, roadIndex) => {
        const count = Math.min(5, Math.max(2, Math.round(road.strength / 1.7)));
        const dx = road.to[0] - road.from[0];
        const dz = road.to[1] - road.from[1];
        const length = Math.max(0.001, Math.hypot(dx, dz));
        return Array.from({ length: count }, (_, index) => ({
          road,
          roadIndex,
          index,
          dx,
          dz,
          length,
          count,
        }));
      })
      .slice(0, 32)
      .forEach(({ road, roadIndex, index, dx, dz, length, count }, fleetIndex) => {
        const kind: VehicleKind =
          fleetIndex % 17 === 0
            ? "bus"
            : fleetIndex % 11 === 0
              ? "van"
              : fleetIndex % 7 === 0
                ? "taxi"
                : fleetIndex % 3 === 0
                  ? "suv"
                  : "sedan";
        output[kind].push({
          road,
          nx: -dz / length,
          nz: dx / length,
          lane: index % 2 === 0 ? 1 : -1,
          offset: index / Math.max(1, count) + seeded(roadIndex * 17 + index, 4) * 0.15,
          speed: 0.028 + seeded(roadIndex * 53 + index, 8) * 0.045,
          color: new Color(kind === "taxi" ? "#d6a91c" : palette[fleetIndex % palette.length]),
          scale:
            kind === "bus"
              ? [1.18, 1.6, 1.64]
              : kind === "van"
                ? [1.1, 1.24, 1.2]
                : kind === "suv"
                  ? [1.08, 1.14, 1.06]
                  : [1, 1, 1],
        });
      });
    return output;
  }, [city.roads]);
  return (
    <group>
      <VehicleFleet kind="sedan" units={Object.values(fleets).flat()} />
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
      <NeighborhoodFabric city={city} />
      <StreetFurniture city={city} />
      <DataTraffic city={city} />
      {viewMode === "explore" && <HeroVehicles city={city} />}
    </group>
  );
}
