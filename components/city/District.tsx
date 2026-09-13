"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import { Color, Group, InstancedMesh, Object3D } from "three";
import { useCityStore } from "@/store/city-store";
import type { CityDistrict, DistrictPurpose } from "@/types/city";

const PAVEMENT: Record<DistrictPurpose, string> = {
  frontend: "#b8b4a8",
  services: "#aaa99d",
  data: "#aa9f8b",
  tests: "#aeb0ad",
  docs: "#b8ae98",
  infrastructure: "#999c95",
  general: "#ada99e",
};

export function District({ district, order }: { district: CityDistrict; order: number }) {
  const group = useRef<Group>(null);
  const elapsed = useRef(-0.12 - order * 0.03);
  const mode = useCityStore((state) => state.viewMode);

  useFrame((_, delta) => {
    if (!group.current || elapsed.current >= 1) return;
    elapsed.current = Math.min(1, elapsed.current + delta);
    group.current.scale.y = Math.max(0.01, elapsed.current);
  });

  return (
    <group ref={group} position={[district.position[0], 0, district.position[1]]}>
      <mesh position={[0, -0.055, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[district.size[0] - 0.7, district.size[1] - 0.7]} />
        <meshStandardMaterial color={PAVEMENT[district.purpose]} roughness={0.98} />
      </mesh>
      <mesh
        position={[district.size[0] * 0.36, -0.045, district.size[1] * 0.34]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.65, 1.45, 32]} />
        <meshStandardMaterial color={district.color} roughness={0.9} />
      </mesh>
      {mode === "map" && (
        <Html
          center
          position={[0, 0.6, -district.size[1] / 2 + 1.3]}
          distanceFactor={27}
          className="district-label-anchor"
        >
          <div className="district-label">
            <span style={{ background: district.color }} />
            {district.name}
            <small>{district.buildingCount}</small>
          </div>
        </Html>
      )}
    </group>
  );
}

/** The city-wide version batches all district slabs and identity medallions into two draws. */
export function DistrictNetwork({ districts }: { districts: CityDistrict[] }) {
  const slabs = useRef<InstancedMesh>(null);
  const medallions = useRef<InstancedMesh>(null);
  const mode = useCityStore((state) => state.viewMode);

  useLayoutEffect(() => {
    const dummy = new Object3D();
    districts.forEach((district, index) => {
      dummy.position.set(district.position[0], -0.055, district.position[1]);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(district.size[0] - 0.7, district.size[1] - 0.7, 1);
      dummy.updateMatrix();
      slabs.current?.setMatrixAt(index, dummy.matrix);
      slabs.current?.setColorAt(index, new Color(PAVEMENT[district.purpose]));

      dummy.position.set(
        district.position[0] + district.size[0] * 0.36,
        -0.045,
        district.position[1] + district.size[1] * 0.34,
      );
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      medallions.current?.setMatrixAt(index, dummy.matrix);
      medallions.current?.setColorAt(index, new Color(district.color));
    });
    for (const ref of [slabs, medallions]) {
      if (!ref.current) continue;
      ref.current.instanceMatrix.needsUpdate = true;
      if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
      ref.current.computeBoundingSphere();
    }
  }, [districts]);

  return (
    <group>
      <instancedMesh ref={slabs} args={[undefined, undefined, districts.length]} receiveShadow>
        <planeGeometry />
        <meshStandardMaterial roughness={0.98} />
      </instancedMesh>
      <instancedMesh ref={medallions} args={[undefined, undefined, districts.length]}>
        <ringGeometry args={[0.65, 1.45, 32]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      {mode === "map" &&
        districts.map((district) => (
          <Html
            key={district.id}
            center
            position={[district.position[0], 0.6, district.position[1] - district.size[1] / 2 + 1.3]}
            distanceFactor={27}
            className="district-label-anchor"
          >
            <div className="district-label">
              <span style={{ background: district.color }} />
              {district.name}
              <small>{district.buildingCount}</small>
            </div>
          </Html>
        ))}
    </group>
  );
}
