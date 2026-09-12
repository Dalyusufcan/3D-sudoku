import { Vector3 } from 'three';
import { toCoordinates } from '../core/cube.ts';

export const CELL_SPACING = 1.25;

/** Y grows upward, and Z grows away from the front face. */
export function cellPosition(index: number): Vector3 {
  const { x, y, z } = toCoordinates(index);
  return new Vector3((x - 1.5) * CELL_SPACING, (y - 1.5) * CELL_SPACING, (1.5 - z) * CELL_SPACING);
}
