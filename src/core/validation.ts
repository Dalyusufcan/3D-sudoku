import { ALL_LINES, CELL_COUNT, type Digit } from './cube.ts';

export interface ValidationResult {
  readonly valid: boolean;
  /** True only when all 64 cells are filled and all axis constraints are valid. */
  readonly complete: boolean;
  readonly conflicts: readonly number[];
  readonly issues: readonly string[];
}

/** Accepts numbers so malformed external boards can be reported without throwing. */
export function validateCube(cube: readonly number[]): ValidationResult {
  const issues: string[] = [];
  const conflicts = new Set<number>();
  if (cube.length !== CELL_COUNT) {
    issues.push('A cube must contain exactly 64 cells.');
  }
  for (let index = 0; index < cube.length; index += 1) {
    const value = cube[index];
    if (value === undefined || !Number.isInteger(value) || value < 0 || value > 4) {
      issues.push(`Cell ${index} must be empty or contain 1, 2, 3, or 4.`);
      conflicts.add(index);
    }
  }
  if (issues.length > 0) {
    return { valid: false, complete: false, conflicts: [...conflicts], issues };
  }

  for (const line of ALL_LINES) {
    const firstIndex = new Map<Digit, number>();
    for (const index of line) {
      const value = cube[index]!;
      if (value === 0) continue;
      const previous = firstIndex.get(value as Digit);
      if (previous !== undefined) {
        conflicts.add(previous);
        conflicts.add(index);
      } else {
        firstIndex.set(value as Digit, index);
      }
    }
  }
  const valid = conflicts.size === 0;
  return {
    valid,
    complete: valid && cube.every((value) => value !== 0),
    conflicts: [...conflicts].sort((a, b) => a - b),
    issues: valid ? [] : ['An axis line contains a repeated value.'],
  };
}
