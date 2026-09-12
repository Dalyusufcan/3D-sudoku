import assert from 'node:assert/strict';
import { test } from 'node:test';
import { axisLinesForCell, toCoordinates, toIndex } from '../src/core/cube.ts';
import { selectionForKey } from '../src/game/input.ts';
import { axisDirection, axisOrigin } from '../src/rendering/orientation.ts';
import { PerspectiveCamera, Vector3 } from 'three';

test('WASD/QE and uppercase aliases move in stable logical coordinates and clamp every boundary', () => {
  const mappings = { a: ['x', -1], d: ['x', 1], w: ['y', 1], s: ['y', -1], q: ['z', -1], e: ['z', 1] } as const;
  for (const [key, [axis, delta]] of Object.entries(mappings)) {
    assert.equal(selectionForKey(null, key), 0);
    for (let index = 0; index < 64; index += 1) {
      const coordinates = toCoordinates(index);
      const expected = toIndex({ ...coordinates, [axis]: Math.max(0, Math.min(3, coordinates[axis] + delta)) });
      assert.equal(selectionForKey(index, key), expected);
      assert.equal(selectionForKey(index, key.toUpperCase()), expected);
      const lines = axisLinesForCell(expected);
      assert.equal(new Set([...lines.x, ...lines.y, ...lines.z]).size, 10);
      for (const name of ['x', 'y', 'z'] as const) {
        assert.ok(lines[name].includes(expected));
        assert.deepEqual(lines[name].map(peer => toCoordinates(peer)[name]), [0, 1, 2, 3]);
      }
    }
  }
});

test('orientation cues share one independent left-side origin and three orthogonal logical directions', () => {
  assert.deepEqual(axisOrigin().toArray(), [-2.76, -2.76, 2.76]);
  const origins = ['x', 'y', 'z'].map(() => axisOrigin());
  assert.notEqual(origins[0], origins[1]);
  for (const origin of origins) assert.ok(origin.equals(origins[0]!));
  assert.deepEqual(axisDirection('x').toArray(), [1, 0, 0]);
  assert.deepEqual(axisDirection('y').toArray(), [0, 1, 0]);
  assert.deepEqual(axisDirection('z').toArray(), [0, 0, -1]);
  assert.equal(axisDirection('x').dot(axisDirection('z')), 0);
  const camera = new PerspectiveCamera(38, 1.5, .1, 100);
  camera.position.copy(new Vector3(7.8, 6.1, 9.3).normalize().multiplyScalar(14.5));
  camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  assert.ok(axisOrigin().project(camera).x < -0.2, 'shared origin projects to the left in the overview');
});
