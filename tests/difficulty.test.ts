import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_LINES, emptyCube, toCoordinates, toIndex } from '../src/core/cube.ts';
import { analyzeDifficulty, DIFFICULTIES, isDifficulty } from '../src/core/difficulty.ts';
import { DIFFICULTY_ATTEMPT_BUDGET, DifficultyGenerationError, generateForDifficulty } from '../src/core/difficulty-generator.ts';
import { generatePuzzle } from '../src/core/generator.ts';
import { countSolutions } from '../src/core/solver.ts';
import { solveLogically } from '../src/core/logical-solver.ts';
import { LOGIC_FIXTURES, boardFrom } from './fixtures/difficulty.ts';

test('three technique tiers produce independently verified unique puzzles across seeds', context => {
  let maxMs = 0;
  for (const difficulty of DIFFICULTIES) {
    const boards = new Set<string>();
    for (let seed = 0; seed < 50; seed += 1) {
      const puzzle = generateForDifficulty(`bands-${seed}`, difficulty);
      assert.equal(puzzle.difficulty, difficulty);
      assert.equal(puzzle.matched, true);
      assert.equal(puzzle.analysis.category, difficulty);
      assert.deepEqual(analyzeDifficulty(puzzle.puzzle), puzzle.analysis);
      assert.ok(puzzle.attempts <= DIFFICULTY_ATTEMPT_BUDGET);
      const direct = solveLogically(puzzle.puzzle, 'singles');
      const logic = solveLogically(puzzle.puzzle);
      assert.equal(direct.status === 'solved', difficulty === 'easy');
      assert.equal(logic.status === 'solved', difficulty !== 'hard');
      if (difficulty === 'medium') assert.ok(puzzle.analysis.hiddenSingles + puzzle.analysis.pairEliminations > 0);
      assert.equal(puzzle.analysis.branches > 0, difficulty === 'hard');
      assert.equal(countSolutions(puzzle.puzzle, 2), 1);
      for (const line of ALL_LINES) assert.deepEqual(line.map(index => puzzle.solution[index]).sort(), [1, 2, 3, 4]);
      puzzle.puzzle.forEach((value, index) => {
        assert.equal(puzzle.fixed[index], value !== 0);
        if (value !== 0) assert.equal(value, puzzle.solution[index]);
      });
      boards.add(puzzle.puzzle.join(''));
      maxMs = Math.max(maxMs, puzzle.totalGenerationMs);
    }
    assert.equal(boards.size, 50);
  }
  // A generous regression ceiling, not a promise about browser/device speed.
  assert.ok(maxMs < 5_000, `Unexpected generation delay: ${maxMs} ms`);
  context.diagnostic(`150 rated puzzles: maximum ${maxMs.toFixed(2)} ms; every puzzle unique and matched.`);
});

test('equal clue counts can have different difficulty categories because arrangements differ', () => {
  const a = analyzeDifficulty(boardFrom(LOGIC_FIXTURES.hard))!;
  const b = analyzeDifficulty(boardFrom(LOGIC_FIXTURES.easy))!;
  assert.equal(a.clueCount, b.clueCount);
  assert.equal(a.category, 'hard');
  assert.equal(b.category, 'easy');
  assert.ok(a.logicalStalledCells > 0);
  assert.equal(b.logicalStalledCells, 0);
});

test('difficulty mismatch retries deterministically, and exhaustion never mislabels a fallback', () => {
  const seed = 'bands-1';
  assert.throws(() => generateForDifficulty(seed, 'hard', 1), error => error instanceof DifficultyGenerationError && error.attempts === 1);
  const retried = generateForDifficulty(seed, 'hard');
  assert.equal(retried.matched, true);
  assert.ok(retried.attempts > 1);
  const replay = generateForDifficulty(seed, 'hard');
  assert.deepEqual(replay.puzzle, retried.puzzle);
  assert.deepEqual(replay.analysis, retried.analysis);
  assert.equal(replay.attempts, retried.attempts);
  assert.notDeepEqual(generateForDifficulty(seed, 'easy').puzzle, retried.puzzle);
  for (const budget of [0, -1, 101, 1.2, NaN]) assert.throws(() => generateForDifficulty('x', 'easy', budget), RangeError);
});

test('analyzer returns an explicit invalid outcome and accepts exactly three difficulty names', () => {
  const invalid = emptyCube(); invalid[0] = 1; invalid[1] = 1;
  assert.equal(analyzeDifficulty(invalid), null);
  assert.equal(analyzeDifficulty(emptyCube()), null);
  assert.equal(analyzeDifficulty([]), null);
  const full = analyzeDifficulty(generatePuzzle('full', 64).puzzle)!;
  assert.equal(full.category, 'easy');
  assert.equal(full.nakedSingles + full.hiddenSingles + full.branches, 0);
  for (const value of DIFFICULTIES) assert.equal(isDifficulty(value), true);
  for (const value of [null, '', 'expert', 'Easy', '<script>']) assert.equal(isDifficulty(value), false);
});

test('calibration outliers succeed within the expanded deterministic attempt budget', () => {
  for (const seed of ['heldout-v2-209', 'heldout-v2-689']) {
    const result = generateForDifficulty(seed, 'hard');
    assert.ok(result.attempts > 64 && result.attempts <= DIFFICULTY_ATTEMPT_BUDGET);
    assert.equal(result.analysis.category, 'hard');
    assert.equal(countSolutions(result.puzzle), 1);
  }
});

test('technique categories survive digit relabeling, axis permutations and coordinate permutations', () => {
  const permutations = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  for (const difficulty of DIFFICULTIES) {
    const original = boardFrom(LOGIC_FIXTURES[difficulty]);
    for (const axes of permutations) {
      const transformed = emptyCube();
      original.forEach((value, index) => {
        const { x, y, z } = toCoordinates(index);
        const coordinates = [3 - x, (y + 1) % 4, z];
        transformed[toIndex({ x: coordinates[axes[0]!]!, y: coordinates[axes[1]!]!, z: coordinates[axes[2]!]! })] = value === 0 ? 0 : ([3, 1, 4, 2] as const)[value - 1]!;
      });
      assert.equal(analyzeDifficulty(transformed)?.category, difficulty);
    }
  }
});
