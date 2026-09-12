export const SIZE = 4;
export const CELL_COUNT = SIZE ** 3;
export const DIGITS = [1, 2, 3, 4] as const;

export type Digit = (typeof DIGITS)[number];
export type CellValue = 0 | Digit;
export type Cube = readonly CellValue[];
export type Axis = 'x' | 'y' | 'z';

export interface Coordinates {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface CellAxisLines {
  readonly x: readonly number[];
  readonly y: readonly number[];
  readonly z: readonly number[];
}

function isCoordinate(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < SIZE;
}

export function toIndex({ x, y, z }: Coordinates): number {
  if (!isCoordinate(x) || !isCoordinate(y) || !isCoordinate(z)) {
    throw new RangeError('Cube coordinates must be integers from 0 to 3.');
  }
  return x + SIZE * y + SIZE * SIZE * z;
}

export function toCoordinates(index: number): Coordinates {
  if (!Number.isInteger(index) || index < 0 || index >= CELL_COUNT) {
    throw new RangeError('Cell index must be an integer from 0 to 63.');
  }
  return {
    x: index % SIZE,
    y: Math.floor(index / SIZE) % SIZE,
    z: Math.floor(index / (SIZE * SIZE)),
  };
}

function makeLines(axis: Axis): readonly (readonly number[])[] {
  const lines: number[][] = [];
  for (let a = 0; a < SIZE; a += 1) {
    for (let b = 0; b < SIZE; b += 1) {
      const line: number[] = [];
      for (let varying = 0; varying < SIZE; varying += 1) {
        const coordinates = axis === 'x'
          ? { x: varying, y: b, z: a }
          : axis === 'y'
            ? { x: b, y: varying, z: a }
            : { x: b, y: a, z: varying };
        line.push(toIndex(coordinates));
      }
      lines.push(line);
    }
  }
  return Object.freeze(lines.map((line) => Object.freeze(line)));
}

export const AXIS_LINES: Readonly<Record<Axis, readonly (readonly number[])[]>> = Object.freeze({
  x: makeLines('x'),
  y: makeLines('y'),
  z: makeLines('z'),
});

/** Exactly 48 constraints: 16 X lines, then 16 Y lines, then 16 Z lines. */
export const ALL_LINES = Object.freeze([...AXIS_LINES.x, ...AXIS_LINES.y, ...AXIS_LINES.z]);

/** Precomputed topology is shared by validation, solving, and game selection. */
export const CELL_LINE_INDICES: readonly (readonly number[])[] = Object.freeze(
  Array.from({ length: CELL_COUNT }, (_, index) => Object.freeze(
    ALL_LINES.flatMap((line, lineIndex) => line.includes(index) ? [lineIndex] : []),
  )),
);

export function axisLinesForCell(index: number): CellAxisLines {
  // Validate at the public boundary; the precomputed topology then guarantees a match.
  toCoordinates(index);
  return {
    x: AXIS_LINES.x.find((line) => line.includes(index))!,
    y: AXIS_LINES.y.find((line) => line.includes(index))!,
    z: AXIS_LINES.z.find((line) => line.includes(index))!,
  };
}

export function emptyCube(): CellValue[] {
  return Array<CellValue>(CELL_COUNT).fill(0);
}
