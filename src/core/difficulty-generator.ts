import { analyzeDifficulty, isDifficulty, type Difficulty, type DifficultyAnalysis } from './difficulty.ts';
import { generatePuzzle, GenerationBudgetError, type GeneratedPuzzle } from './generator.ts';

/** Clue targets guide sampling only; acceptance always requires the requested technique tier. */
export const DIFFICULTY_PROFILES = {
  easy: { targetClues: 24 },
  medium: { targetClues: 0 },
  hard: { targetClues: 0 },
} as const;
export const DIFFICULTY_ATTEMPT_BUDGET = 96;

export interface RatedPuzzle extends GeneratedPuzzle {
  readonly difficulty: Difficulty;
  readonly analysis: DifficultyAnalysis;
  readonly matched: true;
  readonly attempts: number;
  readonly totalGenerationMs: number;
}

export class DifficultyGenerationError extends Error {
  readonly attempts: number;
  constructor(attempts: number) {
    super('No puzzle matched this difficulty within the generation budget. Try a new seed or another level.');
    this.name = 'DifficultyGenerationError';
    this.attempts = attempts;
  }
}

/** Deterministic bounded rejection sampling. Never silently substitute another tier. */
export function generateForDifficulty(seed: string, difficulty: Difficulty, attemptBudget = DIFFICULTY_ATTEMPT_BUDGET): RatedPuzzle {
  if (!isDifficulty(difficulty)) throw new RangeError('Unknown difficulty.');
  if (!Number.isInteger(attemptBudget) || attemptBudget < 1 || attemptBudget > 100) {
    throw new RangeError('The difficulty attempt budget must be from 1 to 100.');
  }
  const start = performance.now();
  for (let attempt = 1; attempt <= attemptBudget; attempt += 1) {
    let generated: GeneratedPuzzle;
    try {
      generated = generatePuzzle(`${seed}/${difficulty}/${attempt}`, DIFFICULTY_PROFILES[difficulty].targetClues);
    } catch (error: unknown) {
      if (error instanceof GenerationBudgetError) continue;
      throw error;
    }
    const analysis = analyzeDifficulty(generated.puzzle);
    if (analysis?.category !== difficulty) continue;
    return {
      ...generated, seed, difficulty, analysis, matched: true, attempts: attempt,
      totalGenerationMs: performance.now() - start,
    };
  }
  throw new DifficultyGenerationError(attemptBudget);
}
