import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_LINES, emptyCube } from '../src/core/cube.ts';
import { analyzeDifficulty, DIFFICULTIES, isDifficulty } from '../src/core/difficulty.ts';
import { DIFFICULTY_PROFILES, generateForDifficulty } from '../src/core/difficulty-generator.ts';
import { generatePuzzle } from '../src/core/generator.ts';
import { countSolutions } from '../src/core/solver.ts';

test('three distinct difficulty profiles produce independently verified unique puzzles across seeds', context => {
  const means: number[] = [];
  let maxMs = 0;
  for (const difficulty of DIFFICULTIES) {
    const clueCounts: number[] = [];
    const profile = DIFFICULTY_PROFILES[difficulty];
    for (let seed = 0; seed < 18; seed += 1) {
      const puzzle = generateForDifficulty(`bands-${seed}`, difficulty);
      assert.equal(puzzle.difficulty, difficulty);
      assert.equal(puzzle.matched, true);
      assert.equal(puzzle.analysis.category, difficulty);
      assert.ok(puzzle.stats.clueCount >= profile.minClues && puzzle.stats.clueCount <= profile.maxClues);
      assert.equal(countSolutions(puzzle.puzzle, 2), 1);
      for (const line of ALL_LINES) assert.deepEqual(line.map(index => puzzle.solution[index]).sort(), [1, 2, 3, 4]);
      puzzle.puzzle.forEach((value, index) => {
        assert.equal(puzzle.fixed[index], value !== 0);
        if (value !== 0) assert.equal(value, puzzle.solution[index]);
      });
      clueCounts.push(puzzle.stats.clueCount);
      maxMs = Math.max(maxMs, puzzle.totalGenerationMs);
    }
    assert.ok(new Set(clueCounts).size > 1);
    means.push(clueCounts.reduce((a, b) => a + b) / clueCounts.length);
  }
  assert.ok(means[0]! > means[1]! && means[1]! > means[2]!);
  context.diagnostic(`54 rated puzzles: maximum ${maxMs.toFixed(2)} ms; mean clues ${means.map(value => value.toFixed(1)).join(', ')}.`);
});

test('equal clue counts can have different difficulty categories because arrangements differ', () => {
  const a = analyzeDifficulty(generatePuzzle('calibrate-0', 30).puzzle)!;
  const b = analyzeDifficulty(generatePuzzle('calibrate-3', 30).puzzle)!;
  assert.equal(a.clueCount, b.clueCount);
  assert.equal(a.category, 'medium');
  assert.equal(b.category, 'easy');
  assert.ok(a.averageCandidates > b.averageCandidates || a.singlesRounds > b.singlesRounds);
  assert.ok(a.score > b.score);
});

test('difficulty mismatch retries deterministically, and exhaustion retains a unique fallback', () => {
  const first = generateForDifficulty('bands-1', 'hard', 1);
  assert.equal(first.matched, false);
  assert.equal(first.attempts, 1);
  assert.equal(countSolutions(first.puzzle, 2), 1);
  const retried = generateForDifficulty('bands-1', 'hard');
  assert.equal(retried.matched, true);
  assert.ok(retried.attempts > 1);
  assert.notDeepEqual(retried.puzzle, first.puzzle);
  const replay = generateForDifficulty('bands-1', 'hard');
  assert.deepEqual(replay.puzzle, retried.puzzle);
  assert.deepEqual(replay.analysis, retried.analysis);
  assert.equal(replay.attempts, retried.attempts);
  assert.notDeepEqual(generateForDifficulty('bands-1', 'easy').puzzle, retried.puzzle);
  for (const budget of [0, -1, 101, 1.2, NaN]) assert.throws(() => generateForDifficulty('x', 'easy', budget), RangeError);
});

test('analyzer returns an explicit invalid outcome and accepts exactly three difficulty names', () => {
  const invalid = emptyCube(); invalid[0] = 1; invalid[1] = 1;
  assert.equal(analyzeDifficulty(invalid), null);
  assert.equal(analyzeDifficulty(generatePuzzle('full', 64).puzzle)?.score, 0);
  for (const value of DIFFICULTIES) assert.equal(isDifficulty(value), true);
  for (const value of [null, '', 'expert', 'Easy', '<script>']) assert.equal(isDifficulty(value), false);
});
