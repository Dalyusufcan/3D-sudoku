import { ALL_LINES, CELL_COUNT, CELL_LINE_INDICES, DIGITS, type CellValue, type Cube, type Digit } from './cube.ts';
import { type RandomSource, shuffled } from './random.ts';
import { validateCube } from './validation.ts';

export interface SolverResult {
  readonly solution: CellValue[] | null;
  readonly nodes: number;
}

export interface SolutionCountResult extends SolverResult {
  readonly count: number;
  /** The requested count was reached, so remaining branches were not explored. */
  readonly cutoffReached: boolean;
}

const ALL_DIGITS_MASK = 0b1111;
const BIT_COUNTS = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4] as const;

/**
 * MRV chooses the smallest candidate set. Single candidates propagate immediately;
 * three four-bit line masks make candidate calculation and undo inexpensive.
 * Random candidate order is used only when constructing a fresh complete cube.
 */
export function analyzeSolutions(cube: Cube, limit = 2, random?: RandomSource): SolutionCountResult {
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new RangeError('The solution limit must be a positive safe integer.');
  }
  if (!validateCube(cube).valid) {
    return { count: 0, solution: null, nodes: 0, cutoffReached: false };
  }

  const board = [...cube];
  const lineMasks = new Uint8Array(ALL_LINES.length);
  for (let index = 0; index < CELL_COUNT; index += 1) {
    const value = board[index]!;
    if (value === 0) continue;
    for (const lineIndex of CELL_LINE_INDICES[index]!) {
      lineMasks[lineIndex] = lineMasks[lineIndex]! | (1 << (value - 1));
    }
  }

  let count = 0;
  let nodes = 0;
  let solution: CellValue[] | null = null;

  function search(): void {
    if (count >= limit) return;
    nodes += 1;
    let bestIndex = -1;
    let bestMask = 0;
    let bestCount = 5;
    for (let index = 0; index < CELL_COUNT; index += 1) {
      if (board[index] !== 0) continue;
      let used = 0;
      for (const lineIndex of CELL_LINE_INDICES[index]!) used |= lineMasks[lineIndex]!;
      const mask = ALL_DIGITS_MASK & ~used;
      const candidateCount = BIT_COUNTS[mask]!;
      if (candidateCount === 0) return;
      if (candidateCount < bestCount) {
        bestIndex = index;
        bestMask = mask;
        bestCount = candidateCount;
        if (candidateCount === 1) break;
      }
    }

    if (bestIndex === -1) {
      count += 1;
      if (solution === null) solution = [...board];
      return;
    }

    const allowed = DIGITS.filter((value) => (bestMask & (1 << (value - 1))) !== 0);
    const candidates: readonly Digit[] = random ? shuffled(allowed, random) : allowed;
    const cellLines = CELL_LINE_INDICES[bestIndex]!;
    for (const value of candidates) {
      const bit = 1 << (value - 1);
      board[bestIndex] = value;
      for (const lineIndex of cellLines) lineMasks[lineIndex] = lineMasks[lineIndex]! | bit;
      search();
      // Validation and candidates guarantee that no other cell in these lines has this bit.
      for (const lineIndex of cellLines) lineMasks[lineIndex] = lineMasks[lineIndex]! & ~bit;
      board[bestIndex] = 0;
      if (count >= limit) break;
    }
  }

  search();
  return { count, solution, nodes, cutoffReached: count >= limit };
}

export function solve(cube: Cube): SolverResult {
  const { solution, nodes } = analyzeSolutions(cube, 1);
  return { solution, nodes };
}

export function countSolutions(cube: Cube, limit = 2): number {
  return analyzeSolutions(cube, limit).count;
}
