import { BoxGeometry, BufferGeometry, CylinderGeometry, ExtrudeGeometry, Shape } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

/**
 * Every primitive here is non-indexed and carries position/normal/uv, because the building
 * assembler merges them into one geometry per building and `mergeGeometries` refuses to
 * mix indexed and non-indexed inputs or differing attribute sets.
 */
function primitive(geometry: BufferGeometry) {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  flat.computeVertexNormals();
  geometry.dispose();
  return flat;
}

export const UNIT_BOX = primitive(new BoxGeometry(1, 1, 1));
/** Soft concrete edge used by contemporary towers instead of a perfect CG cube. */
export const UNIT_ROUNDED_BOX = primitive(new RoundedBoxGeometry(1, 1, 1, 1, 0.055));
export const UNIT_CYLINDER_8 = primitive(new CylinderGeometry(1, 1, 1, 8));
export const UNIT_CYLINDER_16 = primitive(new CylinderGeometry(1, 1, 1, 16));

const chamferedCache = new Map<number, BufferGeometry>();

/** Unit prism with four clipped corners, common in Mexican office and apartment blocks. */
export function chamferedUnit(chamfer = 0.1) {
  const key = Math.round(chamfer * 100) / 100;
  const cached = chamferedCache.get(key);
  if (cached) return cached;
  const c = Math.min(0.22, Math.max(0.02, key));
  const shape = new Shape()
    .moveTo(-0.5 + c, -0.5)
    .lineTo(0.5 - c, -0.5)
    .lineTo(0.5, -0.5 + c)
    .lineTo(0.5, 0.5 - c)
    .lineTo(0.5 - c, 0.5)
    .lineTo(-0.5 + c, 0.5)
    .lineTo(-0.5, 0.5 - c)
    .lineTo(-0.5, -0.5 + c)
    .closePath();
  // ExtrudeGeometry grows along Z; rotate it so its height becomes Y and centre it.
  const geometry = new ExtrudeGeometry(shape, {
    depth: 1,
    bevelEnabled: true,
    bevelSize: 0.018,
    bevelThickness: 0.018,
    bevelSegments: 1,
  });
  geometry.translate(0, 0, -0.5).rotateX(-Math.PI / 2);
  const result = primitive(geometry);
  chamferedCache.set(key, result);
  return result;
}

/** Circumradius of a unit square: a 4-gon at this radius spans exactly 1 across its flats. */
const SQUARE_RADIUS = Math.SQRT1_2;

const taperedCache = new Map<number, BufferGeometry>();

/**
 * A unit prism whose top face is `taper` times the base. Faces stay flat and the side UVs
 * wrap the whole perimeter, so facade textures repeat across all four elevations with a
 * single horizontal scale of `bays * 4`.
 */
export function taperedUnit(taper: number) {
  const key = Math.round(taper * 100) / 100;
  const cached = taperedCache.get(key);
  if (cached) return cached;

  const geometry = primitive(
    new CylinderGeometry(SQUARE_RADIUS * key, SQUARE_RADIUS, 1, 4, 1).rotateY(Math.PI / 4),
  );
  taperedCache.set(key, geometry);
  return geometry;
}
