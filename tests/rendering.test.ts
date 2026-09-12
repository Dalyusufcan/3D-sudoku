import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PerspectiveCamera, Vector3 } from 'three';
import { axisLinesForCell, CELL_COUNT, toCoordinates, toIndex } from '../src/core/cube.ts';
import { CAMERA_FOV, focusFrame, overviewDistance } from '../src/rendering/framing.ts';
import { CELL_SPACING, cellPosition } from '../src/rendering/positions.ts';

test('all 64 rendered cells have distinct, centered positions with upward Y and inward Z', () => {
  const positions = Array.from({ length: CELL_COUNT }, (_, index) => cellPosition(index));
  assert.equal(new Set(positions.map(position => position.toArray().join(','))).size, CELL_COUNT);
  assert.deepEqual(positions.reduce((sum, position) => sum.add(position), new Vector3()).toArray(), [0, 0, 0]);
  const halfExtent = CELL_SPACING * 1.5;
  assert.deepEqual(cellPosition(toIndex({ x: 0, y: 0, z: 0 })).toArray(), [-halfExtent, -halfExtent, halfExtent]);
  assert.deepEqual(cellPosition(toIndex({ x: 3, y: 3, z: 3 })).toArray(), [halfExtent, halfExtent, -halfExtent]);
  for (let index = 0; index < CELL_COUNT; index += 1) {
    const coordinates = toCoordinates(index);
    const position = cellPosition(index);
    for (const axis of ['x', 'y', 'z'] as const) {
      if (coordinates[axis] === 3) continue;
      const next = cellPosition(toIndex({ ...coordinates, [axis]: coordinates[axis] + 1 }));
      const offset = next.clone().sub(position);
      assert.equal(offset.length(), CELL_SPACING);
      assert.equal(offset[axis], axis === 'z' ? -CELL_SPACING : CELL_SPACING);
      for (const other of ['x', 'y', 'z'] as const) {
        if (other !== axis) assert.equal(offset[other], 0);
      }
    }
  }
});

test('each rendered four-cell axis is straight and equally spaced', () => {
  for (let index = 0; index < CELL_COUNT; index += 1) {
    const lines = axisLinesForCell(index);
    for (const axis of ['x', 'y', 'z'] as const) {
      const line = lines[axis];
      const start = cellPosition(line[0]!);
      const end = cellPosition(line[3]!);
      assert.equal(start.distanceTo(end), 3 * CELL_SPACING);
      line.forEach((peer, offset) => {
        assert.deepEqual(cellPosition(peer).toArray(), start.clone().lerp(end, offset / 3).toArray());
      });
    }
  }
});

test('render position lookup rejects invalid cell indices and returns independent vectors', () => {
  for (const index of [-1, CELL_COUNT, 0.1, Infinity, Number.NaN]) {
    assert.throws(() => cellPosition(index), RangeError);
  }
  const first = cellPosition(0);
  const independent = cellPosition(0);
  first.set(0, 0, 0);
  assert.notDeepEqual(first, independent);
  assert.deepEqual(cellPosition(0), independent);
});

test('focused framing keeps all ten cell bounds visible for every selection, viewport, and orbit', () => {
  const directions = [
    new Vector3(7.8, 6.1, 9.3), new Vector3(-8, 6, -9), new Vector3(1, 0, 0),
    new Vector3(0, 0, -1), new Vector3(0.1, 1, 0.1), new Vector3(-1, -1, 1),
  ];
  for (const aspect of [0.55, 0.78, 1, 1.4, 2]) {
    for (let index = 0; index < CELL_COUNT; index += 1) {
      const { target, distance } = focusFrame(index, aspect);
      assert.ok(Number.isFinite(distance) && distance > 0);
      const lines = axisLinesForCell(index);
      const peers = new Set([...lines.x, ...lines.y, ...lines.z]);
      assert.equal(peers.size, 10);
      for (const direction of directions) {
        const camera = new PerspectiveCamera(CAMERA_FOV, aspect, 0.1, 100);
        camera.position.copy(target).addScaledVector(direction.clone().normalize(), distance);
        camera.lookAt(target);
        camera.updateMatrixWorld();
        for (const peer of peers) {
          const center = cellPosition(peer);
          // Include the larger selected outline, not just label centers.
          for (const x of [-0.43, 0.43]) for (const y of [-0.43, 0.43]) for (const z of [-0.43, 0.43]) {
            const projected = center.clone().add(new Vector3(x, y, z)).project(camera);
            assert.ok(Math.abs(projected.x) < 0.94 && Math.abs(projected.y) < 0.94,
              `Clipped cell ${peer}, selection ${index}, aspect ${aspect}`);
            assert.ok(projected.z > -1 && projected.z < 1);
          }
        }
      }
    }
  }
  assert.ok(overviewDistance(1) > 12 * 1.2);
  assert.ok(overviewDistance(0.5) > overviewDistance(1));
});
