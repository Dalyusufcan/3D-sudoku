import { ALL_LINES, CELL_COUNT, CELL_LINE_INDICES, DIGITS, type CellValue, type Cube } from './cube.ts';
import { validateCube } from './validation.ts';

export type LogicLevel = 'singles' | 'line';
export interface LogicStats {
  nakedSingles: number;
  hiddenSingles: number;
  singlesRounds: number;
  pairEliminations: number;
}
export interface LogicResult {
  readonly board: CellValue[];
  readonly candidates: readonly number[];
  readonly status: 'solved' | 'stalled' | 'contradiction';
  readonly stats: Readonly<LogicStats>;
}

const FULL_MASK = 15;
const POPCOUNT = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4] as const;
const bit = (value: number): number => 1 << (value - 1);
const singleValue = (mask: number): CellValue => (Math.log2(mask) + 1) as CellValue;

/**
 * Only the 48 visible all-different lines are used. Prefer naked singles, then
 * hidden singles (one place for a digit), then naked pairs (two cells reserve
 * two digits). Every successful pass fills a cell or removes a candidate.
 */
export function solveLogically(puzzle: Cube, level: LogicLevel = 'line'): LogicResult {
  const board = [...puzzle];
  const masks = Array<number>(CELL_COUNT).fill(FULL_MASK);
  const stats: LogicStats = { nakedSingles: 0, hiddenSingles: 0, singlesRounds: 0, pairEliminations: 0 };
  const result = (status: LogicResult['status']): LogicResult => ({ board, candidates: masks, status, stats });
  if (!validateCube(puzzle).valid) return result('contradiction');

  while (true) {
    const used = ALL_LINES.map(line => line.reduce((mask, index) => board[index] === 0 ? mask : mask | bit(board[index]!), 0));
    const singles: [number, CellValue][] = [];
    for (let index = 0; index < CELL_COUNT; index += 1) {
      if (board[index] !== 0) { masks[index] = bit(board[index]!); continue; }
      for (const line of CELL_LINE_INDICES[index]!) masks[index] = masks[index]! & ~used[line]!;
      if (masks[index] === 0) return result('contradiction');
      if (POPCOUNT[masks[index]!] === 1) singles.push([index, singleValue(masks[index]!)]);
    }
    // Missing digits with no location are contradictions even if every cell has candidates.
    for (const line of ALL_LINES) {
      if (line.reduce((mask, index) => mask | masks[index]!, 0) !== FULL_MASK) return result('contradiction');
    }
    if (singles.length > 0) {
      for (const [index, value] of singles) board[index] = value;
      stats.nakedSingles += singles.length;
      stats.singlesRounds += 1;
      if (!validateCube(board).valid) return result('contradiction');
      continue;
    }
    if (board.every(value => value !== 0)) return result('solved');
    if (level === 'singles') return result('stalled');

    const hidden = new Map<number, CellValue>();
    for (let lineIndex = 0; lineIndex < ALL_LINES.length; lineIndex += 1) {
      for (const value of DIGITS) {
        if ((used[lineIndex]! & bit(value)) !== 0) continue;
        const places = ALL_LINES[lineIndex]!.filter(index => board[index] === 0 && (masks[index]! & bit(value)) !== 0);
        if (places.length !== 1) continue;
        const index = places[0]!;
        if (hidden.has(index) && hidden.get(index) !== value) return result('contradiction');
        hidden.set(index, value);
      }
    }
    if (hidden.size > 0) {
      for (const [index, value] of hidden) board[index] = value;
      stats.hiddenSingles += hidden.size;
      if (!validateCube(board).valid) return result('contradiction');
      continue;
    }

    let removed = 0;
    for (const line of ALL_LINES) {
      for (let a = 0; a < line.length; a += 1) {
        const first = line[a]!;
        if (board[first] !== 0 || POPCOUNT[masks[first]!] !== 2) continue;
        for (let b = a + 1; b < line.length; b += 1) {
          const second = line[b]!;
          if (board[second] !== 0 || masks[first] !== masks[second]) continue;
          const pair = masks[first]!;
          for (const index of line) {
            if (index === first || index === second || board[index] !== 0) continue;
            const previous = masks[index]!;
            masks[index] = previous & ~pair;
            removed += POPCOUNT[previous]! - POPCOUNT[masks[index]!]!;
            if (masks[index] === 0) return result('contradiction');
          }
        }
      }
    }
    stats.pairEliminations += removed;
    if (removed === 0) return result('stalled');
  }
}

export interface ReasoningSearch {
  readonly solved: boolean;
  readonly exhausted: boolean;
  readonly branches: number;
  readonly contradictions: number;
  readonly maxDepth: number;
}

/** Diagnostic search after logic stalls; branch depth is not a human rating. */
export function exploreAlternatives(puzzle: Cube, branchBudget = 512): ReasoningSearch {
  if (!Number.isSafeInteger(branchBudget) || branchBudget < 0) throw new RangeError('Invalid branch budget.');
  let branches = 0;
  let contradictions = 0;
  let maxDepth = 0;
  let exhausted = false;
  function search(board: Cube, depth: number): boolean {
    maxDepth = Math.max(maxDepth, depth);
    const logic = solveLogically(board);
    if (logic.status === 'solved') return true;
    if (logic.status === 'contradiction') { contradictions += 1; return false; }
    let index = -1;
    for (let cell = 0; cell < CELL_COUNT; cell += 1) {
      if (logic.board[cell] !== 0) continue;
      if (index === -1 || POPCOUNT[logic.candidates[cell]!]! < POPCOUNT[logic.candidates[index]!]!) index = cell;
    }
    for (const value of DIGITS) {
      if ((logic.candidates[index]! & bit(value)) === 0) continue;
      if (branches >= branchBudget) { exhausted = true; return false; }
      branches += 1;
      const next = [...logic.board];
      next[index] = value;
      if (search(next, depth + 1)) return true;
      if (exhausted) return false;
    }
    return false;
  }
  const solved = search(puzzle, 0);
  return { solved, exhausted, branches, contradictions, maxDepth };
}
