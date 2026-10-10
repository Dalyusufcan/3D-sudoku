import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateForDifficulty } from '../src/core/difficulty-generator.ts';
import type { GenerationRequest, GenerationResponse } from '../src/core/generation-worker.ts';
import { startGeneration, type GenerationWorker } from '../src/game/generation.ts';

class FakeWorker implements GenerationWorker {
  onmessage: GenerationWorker['onmessage'] = null;
  onerror: GenerationWorker['onerror'] = null;
  onmessageerror: GenerationWorker['onmessageerror'] = null;
  requests: GenerationRequest[] = [];
  terminations = 0;
  postMessage(request: GenerationRequest): void { this.requests.push(request); }
  terminate(): void { this.terminations += 1; }
  respond(response: GenerationResponse): void { this.onmessage?.({ data: response } as MessageEvent<GenerationResponse>); }
}

test('generation sends the seed and tier, resolves a result, and disposes its worker exactly once', async () => {
  const worker = new FakeWorker();
  const task = startGeneration('worker', 'easy', () => worker);
  assert.deepEqual(worker.requests, [{ seed: 'worker', difficulty: 'easy' }]);
  const puzzle = generateForDifficulty('worker', 'easy');
  worker.respond({ ok: true, puzzle });
  assert.equal(await task.promise, puzzle);
  task.cancel();
  worker.respond({ ok: false, message: 'Late response' });
  assert.equal(worker.terminations, 1);
});

test('expected generation failures reach the caller without a mislabeled puzzle', async () => {
  const worker = new FakeWorker();
  const task = startGeneration('failure', 'hard', () => worker);
  worker.respond({ ok: false, message: 'No matching puzzle. Try another seed.' });
  await assert.rejects(task.promise, /No matching puzzle/);
  assert.equal(worker.terminations, 1);
});

test('cancellation rejects pending work and prevents late results from completing a new request', async () => {
  const oldWorker = new FakeWorker();
  const old = startGeneration('old', 'hard', () => oldWorker);
  old.cancel();
  await assert.rejects(old.promise, { name: 'AbortError' });
  const newWorker = new FakeWorker();
  const current = startGeneration('new', 'easy', () => newWorker);
  const puzzle = generateForDifficulty('new', 'easy');
  oldWorker.respond({ ok: true, puzzle });
  newWorker.respond({ ok: true, puzzle });
  assert.equal(await current.promise, puzzle);
  assert.equal(oldWorker.terminations, 1);
  assert.equal(newWorker.terminations, 1);
});

test('startup, worker, transport and timeout failures all reject and release resources', async () => {
  await assert.rejects(startGeneration('x', 'easy', () => { throw new Error('Worker unavailable'); }).promise, /could not start/);
  for (const kind of ['error', 'transport', 'timeout', 'post'] as const) {
    const worker = new FakeWorker();
    if (kind === 'post') worker.postMessage = () => { throw new Error('Post failed'); };
    const task = startGeneration('x', 'easy', () => worker, 10);
    if (kind === 'error') {
      let prevented = false;
      worker.onerror?.({ preventDefault: () => { prevented = true; } } as ErrorEvent);
      assert.equal(prevented, true);
    }
    if (kind === 'transport') worker.onmessageerror?.({} as MessageEvent);
    await assert.rejects(task.promise, kind === 'timeout' ? /took too long/ : /could not/);
    assert.equal(worker.terminations, 1);
  }
});
