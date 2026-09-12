import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ALL_LINES,
  AXIS_LINES,
  CELL_COUNT,
  CELL_LINE_INDICES,
  SIZE,
  axisLinesForCell,
  emptyCube,
  toCoordinates,
  toIndex,
  type CellValue,
  type Cube,
} from '../src/core/cube.ts';
import { DEFAULT_TARGET_CLUES, generatePuzzle } from '../src/core/generator.ts';
import { createSeededRandom, shuffled } from '../src/core/random.ts';
import { analyzeSolutions, countSolutions, solve } from '../src/core/solver.ts';
import { validateCube } from '../src/core/validation.ts';

function knownSolution(): CellValue[] {
  return Array.from({ length: CELL_COUNT }, (_, index) => {
    const { x, y, z } = toCoordinates(index);
    return ((x + y + z) % SIZE + 1) as CellValue;
  });
}

function assertEveryAxisIsPermutation(cube: Cube): void {
  for (const axis of ['x', 'y', 'z'] as const) {
    assert.equal(AXIS_LINES[axis].length, 16);
    for (const line of AXIS_LINES[axis]) {
      assert.deepEqual(line.map((index) => cube[index]).sort(), [1, 2, 3, 4], `${axis} line ${line}`);
    }
  }
}

test('coordinate conversion uses X fastest and round-trips all 64 cells', () => {
  assert.equal(toIndex({ x: 0, y: 0, z: 0 }), 0);
  assert.equal(toIndex({ x: 3, y: 0, z: 0 }), 3);
  assert.equal(toIndex({ x: 0, y: 1, z: 0 }), 4);
  assert.equal(toIndex({ x: 0, y: 0, z: 1 }), 16);
  assert.equal(toIndex({ x: 3, y: 3, z: 3 }), 63);
  for (let index = 0; index < CELL_COUNT; index += 1) {
    assert.equal(toIndex(toCoordinates(index)), index);
  }
});

test('invalid coordinates and indices are rejected at the utility boundary', () => {
  for (const value of [-1, 4, 0.5, NaN, Infinity]) {
    assert.throws(() => toIndex({ x: value, y: 0, z: 0 }), RangeError);
    assert.throws(() => toIndex({ x: 0, y: value, z: 0 }), RangeError);
    assert.throws(() => toIndex({ x: 0, y: 0, z: value }), RangeError);
  }
  for (const value of [-1, 64, 0.5, NaN, Infinity]) {
    assert.throws(() => toCoordinates(value), RangeError);
    assert.throws(() => axisLinesForCell(value), RangeError);
  }
});

test('topology has exactly 48 distinct axis lines and three lines per cell', () => {
  assert.equal(ALL_LINES.length, 48);
  assert.equal(new Set(ALL_LINES.map((line) => line.join(','))).size, 48);
  for (let index = 0; index < CELL_COUNT; index += 1) {
    const coordinates = toCoordinates(index);
    const related = axisLinesForCell(index);
    assert.equal(CELL_LINE_INDICES[index]!.length, 3);
    assert.equal(new Set([...related.x, ...related.y, ...related.z]).size, 10);
    for (const axis of ['x', 'y', 'z'] as const) {
      assert.equal(related[axis].length, 4);
      assert.ok(related[axis].includes(index));
      assert.deepEqual(related[axis].map((peer) => toCoordinates(peer)[axis]), [0, 1, 2, 3]);
      for (const peer of related[axis]) {
        for (const fixed of ['x', 'y', 'z'] as const) {
          if (fixed !== axis) assert.equal(toCoordinates(peer)[fixed], coordinates[fixed]);
        }
      }
    }
  }
});

test('valid X line and incomplete non-conflicting cube are accepted without completion', () => {
  const cube = emptyCube();
  for (let x = 0; x < SIZE; x += 1) cube[toIndex({ x, y: 0, z: 0 })] = (x + 1) as CellValue;
  assert.deepEqual(validateCube(cube), { valid: true, complete: false, conflicts: [], issues: [] });
  assert.deepEqual(validateCube(emptyCube()), { valid: true, complete: false, conflicts: [], issues: [] });
});

for (const axis of ['x', 'y', 'z'] as const) {
  test(`validation identifies both duplicate cells on a ${axis.toUpperCase()} line`, () => {
    const cube = emptyCube();
    const first = toIndex({ x: 0, y: 0, z: 0 });
    const second = toIndex({ x: 0, y: 0, z: 0, [axis]: 1 });
    cube[first] = 2;
    cube[second] = 2;
    const result = validateCube(cube);
    assert.equal(result.valid, false);
    assert.equal(result.complete, false);
    assert.deepEqual(result.conflicts, [first, second]);
  });
}

test('validation accepts a complete Latin cube using only the three axis constraints', () => {
  const cube = knownSolution();
  assertEveryAxisIsPermutation(cube);
  assert.deepEqual(validateCube(cube), { valid: true, complete: true, conflicts: [], issues: [] });
  // Equal values on a plane diagonal are legal; no blocks or diagonal rules are added.
  assert.equal(cube[toIndex({ x: 0, y: 1, z: 0 })], cube[toIndex({ x: 1, y: 0, z: 0 })]);
});

test('malformed boards are explicit invalid results, not exceptions', () => {
  assert.equal(validateCube([]).valid, false);
  assert.equal(validateCube(Array(63).fill(0)).valid, false);
  assert.equal(validateCube(Array(65).fill(0)).valid, false);
  for (const badValue of [-1, 5, 1.5, NaN, Infinity]) {
    const cube: number[] = emptyCube();
    cube[7] = badValue;
    assert.equal(validateCube(cube).valid, false);
    assert.deepEqual(validateCube(cube).conflicts, [7]);
  }
  assert.equal(validateCube(Array<number>(64)).valid, false);
});

test('solver fills a known puzzle, retains its clues, and does not mutate input', () => {
  const puzzle = knownSolution().map((value, index) => index % 3 === 0 ? 0 : value);
  const before = [...puzzle];
  const result = solve(puzzle);
  assert.ok(result.solution);
  assert.equal(validateCube(result.solution).complete, true);
  for (let index = 0; index < CELL_COUNT; index += 1) {
    if (puzzle[index] !== 0) assert.equal(result.solution[index], puzzle[index]);
  }
  assert.deepEqual(puzzle, before);
  assert.ok(result.nodes > 0);
});

test('already solved cube returns one solution as an independent copy', () => {
  const cube = knownSolution();
  const result = analyzeSolutions(cube);
  assert.equal(result.count, 1);
  assert.equal(result.cutoffReached, false);
  assert.equal(result.nodes, 1);
  assert.deepEqual(result.solution, cube);
  assert.notEqual(result.solution, cube);
});

test('duplicate input has no solution', () => {
  const cube = emptyCube();
  cube[0] = 1;
  cube[1] = 1;
  assert.deepEqual(analyzeSolutions(cube), { count: 0, solution: null, nodes: 0, cutoffReached: false });
  assert.equal(solve(cube).solution, null);
});

test('non-conflicting but unsatisfiable input has no solution', () => {
  const cube = emptyCube();
  cube[toIndex({ x: 1, y: 0, z: 0 })] = 1;
  cube[toIndex({ x: 2, y: 0, z: 0 })] = 2;
  cube[toIndex({ x: 3, y: 0, z: 0 })] = 3;
  cube[toIndex({ x: 0, y: 1, z: 0 })] = 4;
  assert.equal(validateCube(cube).valid, true);
  assert.equal(countSolutions(cube), 0);
  assert.equal(solve(cube).solution, null);
});

test('solver discovers contradictions beyond the initial candidate calculation', () => {
  const cube = Array.from(
    '1000000004000004002321000240000002300012000021030004020000320020',
    (value) => Number(value) as CellValue,
  );
  const before = [...cube];
  assert.equal(validateCube(cube).valid, true);

  // Derive peers directly from coordinates, independently of the solver's line masks.
  for (let index = 0; index < CELL_COUNT; index += 1) {
    if (cube[index] !== 0) continue;
    const { x, y, z } = toCoordinates(index);
    const used = new Set<CellValue>();
    for (let varying = 0; varying < SIZE; varying += 1) {
      used.add(cube[toIndex({ x: varying, y, z })]!);
      used.add(cube[toIndex({ x, y: varying, z })]!);
      used.add(cube[toIndex({ x, y, z: varying })]!);
    }
    assert.ok(([1, 2, 3, 4] as const).some((value) => !used.has(value)), `Cell ${index} has an initial candidate`);
  }

  const result = analyzeSolutions(cube, 2);
  assert.equal(result.count, 0);
  assert.equal(result.solution, null);
  assert.equal(result.cutoffReached, false);
  assert.ok(result.nodes > 1);
  assert.deepEqual(cube, before);
});

test('ambiguous input stops at each configured solution limit', () => {
  const empty = emptyCube();
  const one = analyzeSolutions(empty, 1);
  const two = analyzeSolutions(empty, 2);
  const three = analyzeSolutions(empty, 3);
  assert.equal(one.count, 1);
  assert.equal(two.count, 2);
  assert.equal(three.count, 3);
  assert.equal(one.cutoffReached, true);
  assert.equal(two.cutoffReached, true);
  assert.equal(three.cutoffReached, true);
  assert.ok(one.nodes < two.nodes);
  assert.ok(two.nodes < three.nodes);
  assert.equal(countSolutions(empty), 2);
  assert.deepEqual(empty, emptyCube());
  for (const limit of [0, -1, 1.5, Infinity, NaN]) {
    assert.throws(() => countSolutions(empty, limit), RangeError);
  }
});

test('seeded randomness is reproducible, bounded, and shuffling leaves input intact', () => {
  const first = createSeededRandom('same-seed');
  const second = createSeededRandom('same-seed');
  const different = createSeededRandom('different-seed');
  const a = Array.from({ length: 30 }, () => first());
  assert.deepEqual(a, Array.from({ length: 30 }, () => second()));
  assert.notDeepEqual(a, Array.from({ length: 30 }, () => different()));
  assert.ok(a.every((value) => value >= 0 && value < 1));
  const original = [1, 2, 3, 4];
  const result = shuffled(original, first);
  assert.deepEqual(original, [1, 2, 3, 4]);
  assert.deepEqual(result.sort(), original);
  assert.notEqual(result, original);
});

test('24 generated seeds satisfy every axis, retain clues, and have exactly one solution', (context) => {
  const puzzles = new Set<string>();
  const solutions = new Set<string>();
  const durations: number[] = [];
  let totalCountCalls = 0;
  let totalNodes = 0;
  for (let trial = 0; trial < 24; trial += 1) {
    const seed = `invariant-${trial}`;
    const generated = generatePuzzle(seed);
    assert.equal(generated.seed, seed);
    assert.equal(generated.puzzle.length, CELL_COUNT);
    assert.equal(generated.solution.length, CELL_COUNT);
    assert.equal(generated.fixed.length, CELL_COUNT);
    assert.equal(validateCube(generated.solution).complete, true);
    assert.equal(validateCube(generated.puzzle).valid, true);
    assertEveryAxisIsPermutation(generated.solution);
    for (let index = 0; index < CELL_COUNT; index += 1) {
      assert.equal(generated.fixed[index], generated.puzzle[index] !== 0);
      if (generated.fixed[index]) assert.equal(generated.puzzle[index], generated.solution[index]);
    }
    const counted = analyzeSolutions(generated.puzzle, 2);
    assert.equal(counted.count, 1, seed);
    assert.deepEqual(counted.solution, generated.solution);
    assert.equal(generated.stats.clueCount, generated.fixed.filter(Boolean).length);
    assert.ok(generated.stats.clueCount >= DEFAULT_TARGET_CLUES);
    assert.ok(generated.stats.clueCount < CELL_COUNT);
    assert.equal(generated.stats.targetClues, DEFAULT_TARGET_CLUES);
    assert.ok(generated.stats.solutionCountCalls >= CELL_COUNT - generated.stats.clueCount);
    assert.ok(generated.stats.solutionCountCalls <= CELL_COUNT);
    assert.ok(generated.stats.searchNodes > 0);
    puzzles.add(generated.puzzle.join(''));
    solutions.add(generated.solution.join(''));
    durations.push(generated.stats.generationMs);
    totalCountCalls += generated.stats.solutionCountCalls;
    totalNodes += generated.stats.searchNodes;
  }
  assert.ok(puzzles.size >= 20, `Only ${puzzles.size} distinct puzzles`);
  assert.ok(solutions.size >= 20, `Only ${solutions.size} distinct solutions`);
  context.diagnostic(`24 seeds: mean ${(durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2)} ms, max ${Math.max(...durations).toFixed(2)} ms; ${totalCountCalls} uniqueness calls; ${totalNodes} search nodes.`);
});

test('same seed reproduces puzzle, solution, fixed cells, and deterministic search statistics', () => {
  const first = generatePuzzle('reproducible Ω seed');
  const second = generatePuzzle('reproducible Ω seed');
  assert.deepEqual(first.puzzle, second.puzzle);
  assert.deepEqual(first.solution, second.solution);
  assert.deepEqual(first.fixed, second.fixed);
  assert.equal(first.stats.solutionCountCalls, second.stats.solutionCountCalls);
  assert.equal(first.stats.searchNodes, second.stats.searchNodes);
});

test('generation does not mutate prior results and returns independent puzzle and solution arrays', () => {
  const first = generatePuzzle('independent-first');
  const snapshot = structuredClone(first);
  generatePuzzle('independent-second');
  assert.deepEqual(first, snapshot);
  assert.notEqual(first.puzzle, first.solution);
  first.puzzle[0] = first.puzzle[0] === 0 ? 1 : 0;
  assert.deepEqual(first.solution, snapshot.solution);
});

test('unreachable clue target returns the best unique result; boundary targets are respected', () => {
  const minimal = generatePuzzle('best-unique', 0);
  assert.ok(minimal.stats.clueCount > 0);
  assert.equal(minimal.stats.solutionCountCalls, CELL_COUNT);
  assert.equal(countSolutions(minimal.puzzle), 1);
  assertEveryAxisIsPermutation(minimal.solution);
  const full = generatePuzzle('keep-full', 64);
  assert.deepEqual(full.puzzle, full.solution);
  assert.equal(full.stats.clueCount, 64);
  assert.equal(full.stats.solutionCountCalls, 0);
  const oneRemoval = generatePuzzle('one-removal', 63);
  assert.equal(oneRemoval.stats.clueCount, 63);
  assert.equal(countSolutions(oneRemoval.puzzle), 1);
  for (const target of [-1, 65, 2.5, NaN, Infinity]) {
    assert.throws(() => generatePuzzle('invalid-target', target), RangeError);
  }
});
