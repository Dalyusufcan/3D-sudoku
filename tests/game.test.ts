import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CELL_COUNT, DIGITS, SIZE, emptyCube, toCoordinates, toIndex, type CellValue } from '../src/core/cube.ts';
import type { GeneratedPuzzle } from '../src/core/generator.ts';
import { selectionForKey } from '../src/game/input.ts';
import { createGame, enterValue, resetGame, selectCell, selectedAxisLines, undoMove } from '../src/game/state.ts';

const solution = Array.from({ length: CELL_COUNT }, (_, index) => {
  const { x, y, z } = toCoordinates(index);
  return DIGITS[(x + y + z) % SIZE]!;
});

function fixture(puzzle: CellValue[]): GeneratedPuzzle {
  return {
    puzzle,
    solution: [...solution],
    fixed: puzzle.map((value) => value !== 0),
    seed: 'game-test',
    stats: {
      generationMs: 0,
      solutionCountCalls: 0,
      searchNodes: 0,
      clueCount: puzzle.filter((value) => value !== 0).length,
      targetClues: 32,
    },
  };
}

function nearlyComplete(): GeneratedPuzzle {
  const puzzle: CellValue[] = [...solution];
  puzzle[1] = 0;
  return fixture(puzzle);
}

test('clues can be selected for inspection but cannot be edited or cleared', () => {
  const game = selectCell(createGame(nearlyComplete()), 0);
  assert.equal(game.selected, 0);
  assert.equal(enterValue(game, 4), game);
  assert.equal(enterValue(game, 0), game);
  assert.equal(game.values[0], solution[0]);
  assert.equal(game.history.length, 0);
});

test('editable values can be entered, changed, cleared, and undone without mutating earlier state', () => {
  const generated = nearlyComplete();
  const original = selectCell(createGame(generated), 1);
  const entered = enterValue(original, 3);
  const changed = enterValue(entered, 4);
  const cleared = enterValue(changed, 0);
  assert.equal(original.values[1], 0);
  assert.equal(generated.puzzle[1], 0);
  assert.equal(entered.values[1], 3);
  assert.equal(changed.values[1], 4);
  assert.equal(cleared.values[1], 0);
  assert.equal(cleared.history.length, 3);
  assert.equal(undoMove(cleared).values[1], 4);
  assert.equal(undoMove(undoMove(cleared)).values[1], 3);
  assert.equal(undoMove(undoMove(undoMove(cleared))).values[1], 0);
  assert.equal(undoMove(original), original);
  assert.equal(enterValue(entered, 3), entered);
});

test('a duplicate player entry conflicts with its clue peer, and clearing removes conflicts', () => {
  const original = selectCell(createGame(nearlyComplete()), 1);
  const conflicting = enterValue(original, 1);
  assert.ok(conflicting.conflicts.includes(0));
  assert.ok(conflicting.conflicts.includes(1));
  assert.equal(conflicting.complete, false);
  const cleared = enterValue(conflicting, 0);
  assert.deepEqual(cleared.conflicts, []);
  assert.equal(cleared.complete, false);
});

test('completion requires a full cube satisfying all constraints', () => {
  const original = selectCell(createGame(nearlyComplete()), 1);
  assert.equal(original.complete, false);
  const solved = enterValue(original, solution[1]!);
  assert.equal(solved.complete, true);
  assert.deepEqual(solved.conflicts, []);
  assert.equal(undoMove(solved).complete, false);
  const wrong = enterValue(original, 1);
  assert.ok(wrong.values.every((value) => value !== 0));
  assert.equal(wrong.complete, false);
  assert.equal(createGame(fixture([...solution])).complete, true);
});

test('rule validation never auto-corrects entries against the stored solution', () => {
  // A sparse fixture isolates game rules from the separate generator uniqueness contract.
  const original = selectCell(createGame(fixture(emptyCube())), 0);
  const entered = enterValue(original, 4);
  assert.notEqual(entered.values[0], original.generated.solution[0]);
  assert.equal(entered.values[0], 4);
  assert.deepEqual(entered.conflicts, []);
  assert.equal(entered.complete, false);

  // A second valid complete cube must also be recognized solely by its constraints.
  let alternate = createGame(fixture(emptyCube()));
  for (let index = 0; index < CELL_COUNT; index += 1) {
    const value = DIGITS[solution[index]! % SIZE]!;
    alternate = enterValue(selectCell(alternate, index), value);
  }
  assert.equal(alternate.complete, true);
  assert.notDeepEqual(alternate.values, alternate.generated.solution);
});

test('reset restores exactly the clues and clears selection, conflicts, and history', () => {
  const original = createGame(nearlyComplete());
  const changed = enterValue(selectCell(original, 1), 1);
  const reset = resetGame(changed);
  assert.deepEqual(reset.values, original.generated.puzzle);
  assert.equal(reset.generated, original.generated);
  assert.equal(reset.selected, null);
  assert.deepEqual(reset.conflicts, []);
  assert.deepEqual(reset.history, []);
  assert.equal(reset.complete, false);
});

test('invalid selection and entry without a selection leave state unchanged', () => {
  const game = createGame(nearlyComplete());
  for (const index of [-1, CELL_COUNT, 0.5, Number.NaN, Infinity]) {
    assert.equal(selectCell(game, index), game);
  }
  assert.equal(enterValue(game, 2), game);
  assert.equal(selectCell(game, null), game);
  const selected = selectCell(game, 1);
  assert.equal(selectCell(selected, 1), selected);
  assert.equal(selectCell(selected, null).selected, null);
});

test('every selected cell has exactly three four-cell axes and nine other related cells', () => {
  const game = createGame(nearlyComplete());
  assert.equal(selectedAxisLines(game), null);
  for (let index = 0; index < CELL_COUNT; index += 1) {
    const axes = selectedAxisLines(selectCell(game, index));
    assert.ok(axes);
    const coordinates = toCoordinates(index);
    assert.equal(new Set([...axes.x, ...axes.y, ...axes.z]).size, 10);
    for (const axis of ['x', 'y', 'z'] as const) {
      const line: readonly number[] = axes[axis];
      assert.equal(line.length, SIZE);
      assert.equal(new Set(line).size, SIZE);
      assert.ok(line.includes(index));
      for (const peer of line) {
        const other = toCoordinates(peer);
        for (const fixedAxis of ['x', 'y', 'z'] as const) {
          if (fixedAxis !== axis) assert.equal(other[fixedAxis], coordinates[fixedAxis]);
        }
      }
    }
  }
});

test('keyboard selection follows X, upward Y, and Z depth, with clamped edges', () => {
  const middle = toIndex({ x: 1, y: 1, z: 1 });
  assert.equal(selectionForKey(middle, 'ArrowLeft'), toIndex({ x: 0, y: 1, z: 1 }));
  assert.equal(selectionForKey(middle, 'ArrowRight'), toIndex({ x: 2, y: 1, z: 1 }));
  assert.equal(selectionForKey(middle, 'ArrowUp'), toIndex({ x: 1, y: 2, z: 1 }));
  assert.equal(selectionForKey(middle, 'ArrowDown'), toIndex({ x: 1, y: 0, z: 1 }));
  assert.equal(selectionForKey(middle, '['), toIndex({ x: 1, y: 1, z: 0 }));
  assert.equal(selectionForKey(middle, ']'), toIndex({ x: 1, y: 1, z: 2 }));
  for (const key of ['ArrowLeft', 'ArrowDown', '[']) assert.equal(selectionForKey(0, key), 0);
  for (const key of ['ArrowRight', 'ArrowUp', ']']) {
    assert.equal(selectionForKey(CELL_COUNT - 1, key), CELL_COUNT - 1);
  }
  assert.equal(selectionForKey(null, 'ArrowRight'), 0);
  assert.equal(selectionForKey(middle, 'Escape'), null);
  assert.equal(selectionForKey(middle, '1'), undefined);
});
