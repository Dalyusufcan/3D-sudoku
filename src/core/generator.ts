import { CELL_COUNT, emptyCube, type CellValue } from './cube.ts';
import { createSeededRandom, shuffled } from './random.ts';
import { analyzeSolutions } from './solver.ts';

/** A conservative starting point; clue count is not a difficulty rating. */
export const DEFAULT_TARGET_CLUES = 32;

export interface GenerationStats {
  readonly generationMs: number;
  readonly solutionCountCalls: number;
  readonly searchNodes: number;
  readonly clueCount: number;
  readonly targetClues: number;
}

export interface GeneratedPuzzle {
  readonly puzzle: CellValue[];
  readonly solution: CellValue[];
  readonly fixed: boolean[];
  readonly seed: string;
  readonly stats: GenerationStats;
}

/** Randomized full solve followed by clue removal verified with a two-solution cutoff. */
export function generatePuzzle(seed: string, targetClues = DEFAULT_TARGET_CLUES): GeneratedPuzzle {
  if (!Number.isInteger(targetClues) || targetClues < 0 || targetClues > CELL_COUNT) {
    throw new RangeError('Target clues must be an integer from 0 to 64.');
  }
  const start = performance.now();
  const random = createSeededRandom(seed);
  const generated = analyzeSolutions(emptyCube(), 1, random);
  // An empty order-four Latin cube always has solutions; failure means an internal bug.
  if (generated.solution === null) throw new Error('Could not construct a complete Latin cube.');
  const solution = generated.solution;
  const puzzle = [...solution];
  const removalOrder = shuffled(Array.from({ length: CELL_COUNT }, (_, index) => index), random);
  let clueCount = CELL_COUNT;
  let solutionCountCalls = 0;
  let searchNodes = generated.nodes;
  for (const index of removalOrder) {
    if (clueCount <= targetClues) break;
    const previous = puzzle[index]!;
    puzzle[index] = 0;
    const result = analyzeSolutions(puzzle, 2);
    solutionCountCalls += 1;
    searchNodes += result.nodes;
    if (result.count === 1) clueCount -= 1;
    else puzzle[index] = previous;
  }

  return {
    puzzle,
    solution,
    fixed: puzzle.map((value) => value !== 0),
    seed,
    stats: {
      generationMs: performance.now() - start,
      solutionCountCalls,
      searchNodes,
      clueCount,
      targetClues,
    },
  };
}
