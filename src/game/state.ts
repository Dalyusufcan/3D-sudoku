import { CELL_COUNT, axisLinesForCell, type CellValue, type Cube } from '../core/cube.ts';
import type { GeneratedPuzzle } from '../core/generator.ts';
import { validateCube } from '../core/validation.ts';

export interface Move {
  readonly index: number;
  readonly previous: CellValue;
}

export interface GameState {
  readonly generated: GeneratedPuzzle;
  readonly values: Cube;
  readonly selected: number | null;
  readonly conflicts: readonly number[];
  readonly complete: boolean;
  readonly history: readonly Move[];
}

function withValues(state: GameState, values: Cube, history: readonly Move[]): GameState {
  const validation = validateCube(values);
  return {
    ...state,
    values,
    conflicts: validation.conflicts,
    complete: validation.valid && validation.complete,
    history,
  };
}

export function createGame(generated: GeneratedPuzzle): GameState {
  const values = [...generated.puzzle];
  const validation = validateCube(values);
  return {
    generated,
    values,
    selected: null,
    conflicts: validation.conflicts,
    complete: validation.valid && validation.complete,
    history: [],
  };
}

export function selectCell(state: GameState, index: number | null): GameState {
  if (index !== null && (!Number.isInteger(index) || index < 0 || index >= CELL_COUNT)) {
    return state;
  }
  return index === state.selected ? state : { ...state, selected: index };
}

/** Expected no-op moves preserve the state reference, including edits to clues. */
export function enterValue(state: GameState, value: CellValue): GameState {
  const index = state.selected;
  if (index === null || state.generated.fixed[index]) return state;
  if (!Number.isInteger(value) || value < 0 || value > 4) return state;
  const previous = state.values[index];
  if (previous === undefined || previous === value) return state;
  const values = [...state.values];
  values[index] = value;
  return withValues(state, values, [...state.history, { index, previous }]);
}

export function undoMove(state: GameState): GameState {
  const move = state.history.at(-1);
  if (move === undefined) return state;
  const values = [...state.values];
  values[move.index] = move.previous;
  return {
    ...withValues(state, values, state.history.slice(0, -1)),
    selected: move.index,
  };
}

export function resetGame(state: GameState): GameState {
  return createGame(state.generated);
}

export function selectedAxisLines(state: GameState): ReturnType<typeof axisLinesForCell> | null {
  return state.selected === null ? null : axisLinesForCell(state.selected);
}
