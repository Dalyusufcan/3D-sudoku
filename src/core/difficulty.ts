import { CELL_COUNT, DIGITS, axisLinesForCell, type CellValue, type Cube } from './cube.ts';
import { solve } from './solver.ts';

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const DIFFICULTY_LABELS: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

export interface DifficultyAnalysis {
  readonly category: Difficulty;
  readonly score: number;
  readonly clueCount: number;
  readonly averageCandidates: number;
  readonly singlesRounds: number;
  readonly stalledCells: number;
  readonly searchNodes: number;
}

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'string' && DIFFICULTIES.some(difficulty => difficulty === value);
}

function candidates(board: Cube, index: number): readonly CellValue[] {
  const lines = axisLinesForCell(index);
  const used = new Set([...lines.x, ...lines.y, ...lines.z].map(peer => board[peer]));
  return DIGITS.filter(value => !used.has(value));
}

/** Arrangement matters: measure candidate ambiguity and progress through simultaneous singles. */
export function analyzeDifficulty(puzzle: Cube): DifficultyAnalysis | null {
  const solved = solve(puzzle);
  if (solved.solution === null) return null;
  const board = [...puzzle];
  const emptyCount = board.filter(value => value === 0).length;
  const totalCandidates = board.reduce<number>((total, value, index) => total + (value === 0 ? candidates(board, index).length : 0), 0);
  const averageCandidates = emptyCount === 0 ? 1 : totalCandidates / emptyCount;
  let singlesRounds = 0;
  while (true) {
    const singles: { index: number; value: CellValue }[] = [];
    board.forEach((value, index) => {
      if (value !== 0) return;
      const allowed = candidates(board, index);
      if (allowed.length === 1) singles.push({ index, value: allowed[0]! });
    });
    if (singles.length === 0) break;
    singlesRounds += 1;
    for (const single of singles) board[single.index] = single.value;
  }
  const stalledCells = board.filter(value => value === 0).length;
  // Clue count is checked separately by generation, not used to calculate this score.
  const score = Math.round((20 * (averageCandidates - 1)
    + 2 * Math.max(0, singlesRounds - 1) + 1.5 * stalledCells
    + 8 * Math.log2(Math.max(1, solved.nodes / (emptyCount + 1)))) * 100) / 100;
  return {
    category: score < 12 ? 'easy' : score < 24 ? 'medium' : 'hard',
    score, clueCount: CELL_COUNT - emptyCount, averageCandidates,
    singlesRounds, stalledCells, searchNodes: solved.nodes,
  };
}
