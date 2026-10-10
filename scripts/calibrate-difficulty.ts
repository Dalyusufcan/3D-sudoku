import assert from 'node:assert/strict';
import { DIFFICULTIES } from '../src/core/difficulty.ts';
import { DifficultyGenerationError, generateForDifficulty } from '../src/core/difficulty-generator.ts';
import { countSolutions } from '../src/core/solver.ts';
import { solveLogically } from '../src/core/logical-solver.ts';
import { validateCube } from '../src/core/validation.ts';

const samples = Number(process.argv[2] ?? 300);
const prefix = process.argv[3] ?? 'calibration-v2';
if (!Number.isSafeInteger(samples) || samples < 1) throw new RangeError('Samples must be a positive integer.');

for (const difficulty of DIFFICULTIES) {
  const times: number[] = [];
  const attempts: number[] = [];
  const clues: number[] = [];
  const branches: number[] = [];
  const failures: string[] = [];
  for (let index = 0; index < samples; index += 1) {
    const seed = `${prefix}-${index}`;
    try {
      const generated = generateForDifficulty(seed, difficulty);
      assert.equal(generated.analysis.category, difficulty);
      assert.equal(validateCube(generated.solution).complete, true);
      assert.equal(validateCube(generated.puzzle).valid, true);
      assert.equal(countSolutions(generated.puzzle), 1);
      assert.equal(solveLogically(generated.puzzle, 'singles').status === 'solved', difficulty === 'easy');
      assert.equal(solveLogically(generated.puzzle).status === 'solved', difficulty !== 'hard');
      generated.puzzle.forEach((value, cell) => {
        assert.equal(generated.fixed[cell], value !== 0);
        if (value !== 0) assert.equal(value, generated.solution[cell]);
      });
      times.push(generated.totalGenerationMs);
      attempts.push(generated.attempts);
      clues.push(generated.stats.clueCount);
      branches.push(generated.analysis.branches);
    } catch (error: unknown) {
      if (!(error instanceof DifficultyGenerationError)) throw error;
      failures.push(seed);
    }
  }
  times.sort((a, b) => a - b);
  const mean = (values: number[]): number => values.length === 0 ? 0 : Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
  console.log(JSON.stringify({
    difficulty, samples, matched: times.length, failures,
    meanMs: mean(times), p95Ms: times[Math.max(0, Math.ceil(times.length * 0.95) - 1)], maxMs: times.at(-1),
    meanAttempts: mean(attempts), maxAttempts: attempts.length === 0 ? 0 : Math.max(...attempts),
    meanClues: mean(clues), meanBranches: mean(branches),
  }));
  if (failures.length > 0) process.exitCode = 1;
}
