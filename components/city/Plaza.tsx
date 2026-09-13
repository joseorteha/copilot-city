"use client";

import { Html } from "@react-three/drei";
import { useLayoutEffect, useRef } from "react";
import { Color, InstancedMesh, Object3D } from "three";

import { useCityStore } from "@/store/city-store";
import type { CityDistrict } from "@/types/city";

export function Plaza({ district, isCore }: { district: CityDistrict; isCore: boolean }) {
  const [x, z] = district.plazaPosition;
  return (
    <group position={[x, 0.08, z]}>
      <mesh receiveShadow position={[0, 0.025, 0]} scale={[1.35, 1, 0.86]}>
        <cylinderGeometry args={[1.65, 1.65, 0.05, 48]} />
        <meshStandardMaterial color="#ddd7c5" roughness={0.88} />
      </mesh>
      <mesh receiveShadow position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.35, 0.86, 1]}>
        <ringGeometry args={[0.92, 1.28, 48]} />
        <meshStandardMaterial color={district.color} roughness={0.84} />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.72, 0.78, 0.14, 48]} />
        <meshStandardMaterial color="#376d76" roughness={0.12} metalness={0.34} />
      </mesh>
      <mesh castShadow position={[0, 0.54, 0]} rotation={[0, Math.PI / 4, 0]}>
        <torusKnotGeometry args={[0.23, 0.055, 24, 4, 2, 3]} />
        <meshStandardMaterial color={isCore ? "#e6bd68" : "#637b79"} metalness={0.62} roughness={0.24} />
      </mesh>
      {isCore && (
        <Html center position={[0, 1.7, 0]} distanceFactor={20} className="district-label-anchor">
          <div className="core-label">
            <span /> NÚCLEO ARQUITECTÓNICO
          </div>
        </Html>
      )}
    </group>
  );
}

export function PlazaNetwork({
  districts,
  coreDistrictId,
}: {
  districts: CityDistrict[];
  coreDistrictId?: string;
}) {
  const platforms = useRef<InstancedMesh>(null);
  const inlays = useRef<InstancedMesh>(null);
  const water = useRef<InstancedMesh>(null);
  const sculptures = useRef<InstancedMesh>(null);
  const viewMode = useCityStore((state) => state.viewMode);
  const coreDistrict = districts.find((district) => district.id === coreDistrictId);

  useLayoutEffect(() => {
    const dummy = new Object3D();
    districts.forEach((district, index) => {
      const [x, z] = district.plazaPosition;
      dummy.position.set(x, 0.105, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(2.2275, 0.05, 1.419);
      dummy.updateMatrix();
      platforms.current?.setMatrixAt(index, dummy.matrix);

      dummy.position.set(x, 0.14, z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(1.35, 0.86, 1);
      dummy.updateMatrix();
      inlays.current?.setMatrixAt(index, dummy.matrix);
      inlays.current?.setColorAt(index, new Color(district.color));

      dummy.position.set(x, 0.18, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(0.75, 0.14, 0.75);
      dummy.updateMatrix();
      water.current?.setMatrixAt(index, dummy.matrix);

      dummy.position.set(x, 0.62, z);
      dummy.rotation.set(0, Math.PI / 4, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      sculptures.current?.setMatrixAt(index, dummy.matrix);
      sculptures.current?.setColorAt(
        index,
        new Color(district.id === coreDistrictId ? "#e6bd68" : "#637b79"),
      );
    });
    for (const ref of [platforms, inlays, water, sculptures]) {
      if (!ref.current) continue;
      ref.current.instanceMatrix.needsUpdate = true;
      if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
      ref.current.computeBoundingSphere();
    }
  }, [coreDistrictId, districts]);

  return (
    <group>
      <instancedMesh ref={platforms} args={[undefined, undefined, districts.length]} receiveShadow>
        <cylinderGeometry args={[1, 1, 1, 48]} />
        <meshStandardMaterial color="#ddd7c5" roughness={0.88} />
      </instancedMesh>
      <instancedMesh ref={inlays} args={[undefined, undefined, districts.length]} receiveShadow>
        <ringGeometry args={[0.92, 1.28, 48]} />
        <meshStandardMaterial roughness={0.84} />
      </instancedMesh>
      <instancedMesh ref={water} args={[undefined, undefined, districts.length]}>
        <cylinderGeometry args={[1, 1, 1, 48]} />
        <meshStandardMaterial color="#376d76" roughness={0.12} metalness={0.34} />
      </instancedMesh>
      <instancedMesh ref={sculptures} args={[undefined, undefined, districts.length]} castShadow>
        <torusKnotGeometry args={[0.23, 0.055, 52, 8, 2, 3]} />
        <meshStandardMaterial metalness={0.62} roughness={0.24} />
      </instancedMesh>
      {coreDistrict && viewMode === "map" && (
        <Html
          center
          position={[coreDistrict.plazaPosition[0], 1.78, coreDistrict.plazaPosition[1]]}
          distanceFactor={20}
          className="district-label-anchor"
        >
          <div className="core-label">
            <span /> NÚCLEO ARQUITECTÓNICO
          </div>
        </Html>
      )}
    </group>
  );
}
