import { CELL_COUNT, type Cube } from './cube.ts';
import { exploreAlternatives, solveLogically } from './logical-solver.ts';
import { analyzeSolutions } from './solver.ts';

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const DIFFICULTY_LABELS: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
export const ANALYSIS_NODE_BUDGET = 20_000;

export interface DifficultyAnalysis {
  readonly category: Difficulty;
  readonly requiredTechnique: 'naked-single' | 'hidden-single' | 'naked-pair' | 'alternatives';
  readonly clueCount: number;
  /** Simultaneous naked-single rounds and unresolved cells before line reasoning. */
  readonly singlesRounds: number;
  readonly stalledCells: number;
  readonly nakedSingles: number;
  readonly hiddenSingles: number;
  readonly pairEliminations: number;
  readonly logicalStalledCells: number;
  /** Diagnostic work, never thresholds for the category. */
  readonly searchNodes: number;
  readonly branches: number;
  readonly contradictions: number;
  readonly maxDepth: number;
}

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'string' && DIFFICULTIES.some(difficulty => difficulty === value);
}

/**
 * Technique tiers, not clue/score bands. Reject invalid, ambiguous, unsatisfiable,
 * or over-budget boards. No stored solution is supplied to the logical solver.
 */
export function analyzeDifficulty(puzzle: Cube): DifficultyAnalysis | null {
  const verified = analyzeSolutions(puzzle, 2, undefined, ANALYSIS_NODE_BUDGET);
  if (verified.count !== 1 || verified.budgetExceeded) return null;
  const direct = solveLogically(puzzle, 'singles');
  const logic = direct.status === 'solved' ? direct : solveLogically(puzzle);
  if (logic.status === 'contradiction') return null;
  const category: Difficulty = direct.status === 'solved' ? 'easy' : logic.status === 'solved' ? 'medium' : 'hard';
  const search = category === 'hard' ? exploreAlternatives(logic.board) : null;
  if (search !== null && !search.solved) return null;
  return {
    category,
    requiredTechnique: category === 'hard' ? 'alternatives' : logic.stats.pairEliminations > 0
      ? 'naked-pair' : logic.stats.hiddenSingles > 0 ? 'hidden-single' : 'naked-single',
    clueCount: puzzle.filter(value => value !== 0).length,
    singlesRounds: direct.stats.singlesRounds,
    stalledCells: direct.board.filter(value => value === 0).length,
    nakedSingles: logic.stats.nakedSingles,
    hiddenSingles: logic.stats.hiddenSingles,
    pairEliminations: logic.stats.pairEliminations,
    logicalStalledCells: CELL_COUNT - logic.board.filter(value => value !== 0).length,
    searchNodes: verified.nodes,
    branches: search?.branches ?? 0,
    contradictions: search?.contradictions ?? 0,
    maxDepth: search?.maxDepth ?? 0,
  };
}
