import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validSeed } from '../src/ui/seed.ts';

test('URL seeds have a bounded, explicit alphabet', () => {
  for (const value of ['hello', 'cube_123-ABC', 'a'.repeat(48)]) assert.equal(validSeed(value), true);
  for (const value of [null, '', 'a'.repeat(49), '<script>', 'a b', 'a\n', 'é']) {
    assert.equal(validSeed(value), false);
  }
});
