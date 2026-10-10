import type { CellValue } from '../../src/core/cube.ts';

// Frozen, independently unique examples; no dependency on generator seed mappings.
export const LOGIC_FIXTURES = {
  easy: '0002000010000003000000000030000030000000000000000000200000100000',
  medium: '0300000300000100000000002003000000020000000000000000000000003010',
  hard: '0000000000000000000000313000000002010000000000000000000000200010',
};
export const boardFrom = (text: string): CellValue[] => Array.from(text, value => Number(value) as CellValue);
