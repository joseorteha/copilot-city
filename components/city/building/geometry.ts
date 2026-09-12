import { BoxGeometry, CylinderGeometry } from "three";

export const UNIT_BOX = new BoxGeometry(1, 1, 1);
export const WINDOW_BOX = new BoxGeometry(1, 1, 0.035);
export const UNIT_CYLINDER_8 = new CylinderGeometry(1, 1, 1, 8);
export const UNIT_CYLINDER_16 = new CylinderGeometry(1, 1, 1, 16);
