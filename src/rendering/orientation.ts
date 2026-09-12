import { Vector3 } from 'three';
import type { Axis } from '../core/cube.ts';

/** All world-space rulers start at the front-left-bottom corner; Z never starts at X's tip. */
export function axisOrigin(): Vector3 { return new Vector3(-2.76, -2.76, 2.76); }
export function axisDirection(axis: Axis): Vector3 {
  return axis === 'x' ? new Vector3(1, 0, 0) : axis === 'y' ? new Vector3(0, 1, 0) : new Vector3(0, 0, -1);
}
