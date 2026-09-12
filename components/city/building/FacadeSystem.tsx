"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { InstancedMesh, Matrix4, Object3D } from "three";

import { WINDOW_BOX } from "@/components/city/building/geometry";
import type { BuildingMaterials } from "@/components/city/building/materials";

interface WindowTransform { position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number]; lit: boolean }

function seeded(pathSeed: number, a: number, b: number) {
  return Math.abs(Math.sin(pathSeed * 91.7 + a * 17.13 + b * 47.77));
}

export function FacadeSystem({ width, depth, height, floors, density, seed, materials }: {
  width: number; depth: number; height: number; floors: number; density: number; seed: string; materials: BuildingMaterials;
}) {
  const darkRef = useRef<InstancedMesh>(null);
  const litRef = useRef<InstancedMesh>(null);
  const transforms = useMemo(() => {
    const result: WindowTransform[] = [];
    const pathSeed = [...seed].reduce((sum, character) => sum + character.charCodeAt(0), 0);
    const visibleFloors = Math.min(12, Math.max(2, floors));
    const floorGap = height / (visibleFloors + 0.65);
    const columnsX = Math.min(6, Math.max(2, Math.floor(width * density * 1.15)));
    const columnsZ = Math.min(5, Math.max(2, Math.floor(depth * density * 1.15)));
    const addFace = (front: boolean, side: number, columns: number, span: number) => {
      for (let floor = 0; floor < visibleFloors; floor += 1) {
        for (let column = 0; column < columns; column += 1) {
          const horizontal = -span / 2 + ((column + 0.5) / columns) * span;
          const y = 0.5 + (floor + 0.54) * floorGap;
          const windowWidth = Math.max(0.16, span / columns * 0.56);
          const windowHeight = Math.min(0.42, floorGap * 0.52);
          const lit = seeded(pathSeed, floor, column + (front ? side * 19 : side * 29)) > 0.78;
          result.push(front
            ? { position: [horizontal, y, side * (depth / 2 + 0.021)], rotation: [0, side < 0 ? Math.PI : 0, 0], scale: [windowWidth, windowHeight, 1], lit }
            : { position: [side * (width / 2 + 0.021), y, horizontal], rotation: [0, side > 0 ? Math.PI / 2 : -Math.PI / 2, 0], scale: [windowWidth, windowHeight, 1], lit });
        }
      }
    };
    addFace(true, 1, columnsX, width * 0.82);
    addFace(true, -1, columnsX, width * 0.82);
    addFace(false, 1, columnsZ, depth * 0.82);
    addFace(false, -1, columnsZ, depth * 0.82);
    return result;
  }, [density, depth, floors, height, seed, width]);

  const dark = transforms.filter((item) => !item.lit);
  const lit = transforms.filter((item) => item.lit);

  useLayoutEffect(() => {
    const dummy = new Object3D();
    const matrix = new Matrix4();
    const write = (mesh: InstancedMesh | null, items: WindowTransform[]) => {
      if (!mesh) return;
      items.forEach((item, index) => {
        dummy.position.set(...item.position);
        dummy.rotation.set(...item.rotation);
        dummy.scale.set(...item.scale);
        dummy.updateMatrix();
        matrix.copy(dummy.matrix);
        mesh.setMatrixAt(index, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    };
    write(darkRef.current, dark);
    write(litRef.current, lit);
  }, [dark, lit]);

  return (
    <group>
      {!!dark.length && <instancedMesh ref={darkRef} args={[WINDOW_BOX, materials.glass, dark.length]} castShadow={false} frustumCulled />}
      {!!lit.length && <instancedMesh ref={litRef} args={[WINDOW_BOX, materials.windowLight, lit.length]} castShadow={false} frustumCulled />}
    </group>
  );
}
