import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyCube } from '../src/core/cube.ts';
import { solveLogically, exploreAlternatives } from '../src/core/logical-solver.ts';
import { countSolutions, solve } from '../src/core/solver.ts';
import { validateCube } from '../src/core/validation.ts';

import { LOGIC_FIXTURES, boardFrom } from './fixtures/difficulty.ts';

test('direct deductions solve Easy; Medium needs line deductions; Hard stalls after pairs', () => {
  for (const [tier, text] of Object.entries(LOGIC_FIXTURES)) {
    const puzzle = boardFrom(text);
    const before = [...puzzle];
    assert.equal(countSolutions(puzzle), 1);
    const direct = solveLogically(puzzle, 'singles');
    const logic = solveLogically(puzzle);
    assert.equal(direct.status, tier === 'easy' ? 'solved' : 'stalled');
    assert.equal(logic.status, tier === 'hard' ? 'stalled' : 'solved');
    if (tier === 'medium') assert.ok(logic.stats.hiddenSingles > 0);
    if (tier === 'hard') assert.ok(logic.stats.pairEliminations > 0);
    const solution = solve(puzzle).solution!;
    for (let index = 0; index < 64; index += 1) {
      if (logic.board[index] !== 0) assert.equal(logic.board[index], solution[index]);
      assert.ok((logic.candidates[index]! & (1 << (solution[index]! - 1))) !== 0);
    }
    assert.deepEqual(puzzle, before);
  }
});

test('deduced values and pair exclusions follow from the visible clues', () => {
  const puzzle = boardFrom(LOGIC_FIXTURES.hard);
  const logic = solveLogically(puzzle);
  for (let index = 0; index < 64; index += 1) {
    if (puzzle[index] !== 0) continue;
    for (const value of [1, 2, 3, 4] as const) {
      if ((logic.candidates[index]! & (1 << (value - 1))) !== 0) continue;
      const alternative = [...puzzle];
      alternative[index] = value;
      assert.equal(countSolutions(alternative), 0, `Excluded ${value} at ${index}`);
    }
  }
});

test('logic detects invalid and non-conflicting impossible boards, and leaves ambiguity stalled', () => {
  assert.equal(solveLogically([]).status, 'contradiction');
  const duplicate = emptyCube(); duplicate[0] = 1; duplicate[1] = 1;
  assert.equal(solveLogically(duplicate).status, 'contradiction');
  const impossible = emptyCube(); impossible[1] = 1; impossible[2] = 2; impossible[3] = 3; impossible[4] = 4;
  assert.equal(validateCube(impossible).valid, true);
  assert.equal(solveLogically(impossible).status, 'contradiction');
  assert.equal(solveLogically(emptyCube()).status, 'stalled');
  const full = solve(boardFrom(LOGIC_FIXTURES.easy)).solution!;
  assert.equal(solveLogically(full).status, 'solved');
  assert.equal(solveLogically(full).stats.nakedSingles, 0);
});

test('alternative exploration counts decisions and contradictions separately from forced moves', () => {
  const hard = boardFrom(LOGIC_FIXTURES.hard);
  const result = exploreAlternatives(hard);
  assert.equal(result.solved, true);
  assert.equal(result.exhausted, false);
  assert.ok(result.branches > 0 && result.contradictions > 0 && result.maxDepth > 0);
  assert.deepEqual(exploreAlternatives(hard), result);
  assert.deepEqual(exploreAlternatives(hard, 0), { solved: false, exhausted: true, branches: 0, contradictions: 0, maxDepth: 0 });
  assert.equal(exploreAlternatives(boardFrom(LOGIC_FIXTURES.easy), 0).solved, true);
  for (const budget of [-1, 0.5, NaN, Infinity]) assert.throws(() => exploreAlternatives(hard, budget), RangeError);
});
