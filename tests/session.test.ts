import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateForDifficulty } from '../src/core/difficulty-generator.ts';
import { beginGeneration, beginPlay, chooseDifficulty, initialSession, updateSession } from '../src/game/session.ts';
import { elapsedTime, formatTime, resetTimer, startTimer, stopTimer } from '../src/game/timer.ts';
import { enterValue, selectCell } from '../src/game/state.ts';

test('timer measures timestamps, formats full minutes, stops idempotently, and resets independently', () => {
  const idle = resetTimer();
  assert.equal(elapsedTime(idle, 100_000), 0);
  const running = startTimer(10_000);
  assert.equal(elapsedTime(running, 75_321), 65_321);
  assert.equal(formatTime(elapsedTime(running, 75_321)), '01:05');
  const stopped = stopTimer(running, 75_321);
  assert.equal(stopped.startedAt, null);
  assert.equal(elapsedTime(stopped, 900_000), 65_321);
  assert.deepEqual(stopTimer(stopped, 900_000), stopped);
  assert.equal(elapsedTime(startTimer(900_000), 901_000), 1_000);
  assert.equal(formatTime(3_661_000), '61:01');
});

test('start and difficulty selection do not run time; only a playable puzzle starts the clock', () => {
  for (const session of [initialSession(), chooseDifficulty(), beginGeneration('medium')]) {
    assert.equal(session.game, null);
    assert.equal(session.timer.startedAt, null);
    assert.equal(elapsedTime(session.timer, 100_000), 0);
  }
  const puzzle = generateForDifficulty('session', 'medium');
  const playing = beginPlay(puzzle, 50_000);
  assert.equal(playing.phase, 'playing');
  assert.equal(playing.difficulty, 'medium');
  assert.equal(elapsedTime(playing.timer, 52_000), 2_000);
  const restarted = beginPlay(puzzle, 99_000);
  assert.equal(elapsedTime(restarted.timer, 99_000), 0);
  assert.equal(restarted.game?.history.length, 0);
});

test('the completing move freezes elapsed time in the result; completed state cannot be edited', () => {
  const puzzle = generateForDifficulty('completion-session', 'easy');
  let session = beginPlay(puzzle, 1_000);
  for (let index = 0; index < puzzle.puzzle.length; index += 1) {
    if (puzzle.fixed[index]) continue;
    const game = enterValue(selectCell(session.game!, index), puzzle.solution[index]!);
    session = updateSession(session, game, 62_456);
  }
  assert.equal(session.phase, 'complete');
  assert.deepEqual(session.result, { difficulty: 'easy', elapsedMs: 61_456 });
  assert.equal(formatTime(session.result!.elapsedMs), '01:01');
  assert.equal(elapsedTime(session.timer, 999_000), 61_456);
  assert.equal(updateSession(session, enterValue(session.game!, 0), 999_000), session);
  for (const next of [initialSession(), chooseDifficulty(), beginGeneration('hard')]) {
    assert.equal(next.timer.startedAt, null);
    assert.equal(elapsedTime(next.timer, 999_000), 0);
    assert.equal(next.result, null);
  }
});
