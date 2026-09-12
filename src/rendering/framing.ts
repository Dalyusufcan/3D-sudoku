import { MathUtils, type Vector3 } from 'three';
import { axisLinesForCell } from '../core/cube.ts';
import { cellPosition } from './positions.ts';

export const CAMERA_FOV = 38;
const OVERVIEW_DISTANCE = 16;
const CELL_BOUNDING_RADIUS = 0.79 * 1.08 * Math.sqrt(3) / 2;

export function overviewDistance(aspect: number): number {
  return OVERVIEW_DISTANCE * Math.max(1, 0.85 / aspect);
}

/** Fit all ten active cells, including their corners, from any orbit direction. */
export function focusFrame(index: number, aspect: number): { target: Vector3; distance: number } {
  const target = cellPosition(index).multiplyScalar(0.3);
  const lines = axisLinesForCell(index);
  const radius = Math.max(...[...lines.x, ...lines.y, ...lines.z]
    .map(peer => cellPosition(peer).distanceTo(target) + CELL_BOUNDING_RADIUS));
  const verticalHalfFov = MathUtils.degToRad(CAMERA_FOV / 2);
  const limitingHalfFov = Math.atan(Math.tan(verticalHalfFov) * Math.min(1, aspect));
  return {
    target,
    // A small angular margin keeps edge labels away from the viewport controls.
    distance: Math.max(overviewDistance(aspect) * 0.83, radius / Math.sin(limitingHalfFov * 0.9)),
  };
}
