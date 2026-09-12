import { analyzeDifficulty, type Difficulty, type DifficultyAnalysis } from './difficulty.ts';
import { generatePuzzle, type GeneratedPuzzle } from './generator.ts';
import { createSeededRandom } from './random.ts';

export const DIFFICULTY_PROFILES: Readonly<Record<Difficulty, { minClues: number; maxClues: number; scoreCenter: number }>> = {
  easy: { minClues: 32, maxClues: 38, scoreCenter: 6 },
  medium: { minClues: 24, maxClues: 30, scoreCenter: 18 },
  hard: { minClues: 16, maxClues: 22, scoreCenter: 32 },
};
export const DIFFICULTY_ATTEMPT_BUDGET = 12;

export interface RatedPuzzle extends GeneratedPuzzle {
  readonly difficulty: Difficulty;
  readonly analysis: DifficultyAnalysis;
  readonly matched: boolean;
  readonly attempts: number;
  readonly totalGenerationMs: number;
}

/** A bounded search for the requested score band AND clue profile. Always retains uniqueness. */
export function generateForDifficulty(seed: string, difficulty: Difficulty, attemptBudget = DIFFICULTY_ATTEMPT_BUDGET): RatedPuzzle {
  if (!Number.isInteger(attemptBudget) || attemptBudget < 1 || attemptBudget > 100) {
    throw new RangeError('The difficulty attempt budget must be from 1 to 100.');
  }
  const start = performance.now();
  const profile = DIFFICULTY_PROFILES[difficulty];
  const random = createSeededRandom(`${seed}/${difficulty}/targets`);
  let best: RatedPuzzle | null = null;
  let bestDistance = Infinity;
  for (let attempt = 1; attempt <= attemptBudget; attempt += 1) {
    const target = profile.minClues + Math.floor(random() * (profile.maxClues - profile.minClues + 1));
    const generated = generatePuzzle(`${seed}/${difficulty}/${attempt}`, target);
    const analysis = analyzeDifficulty(generated.puzzle);
    if (analysis === null) throw new Error('A generated unique puzzle could not be analyzed.');
    const matched = analysis.category === difficulty
      && analysis.clueCount >= profile.minClues && analysis.clueCount <= profile.maxClues;
    const candidate: RatedPuzzle = {
      ...generated, seed, difficulty, analysis, matched, attempts: attempt,
      totalGenerationMs: performance.now() - start,
    };
    if (matched) return candidate;
    const distance = Math.abs(analysis.score - profile.scoreCenter)
      + Math.max(0, analysis.clueCount - profile.maxClues) * 4;
    if (distance < bestDistance) { best = candidate; bestDistance = distance; }
  }
  // A difficulty mismatch is an expected bounded-search outcome, never a reason to lose uniqueness.
  return { ...best!, attempts: attemptBudget, totalGenerationMs: performance.now() - start };
}
