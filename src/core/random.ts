export type RandomSource = () => number;

/** FNV-1a string hashing followed by Mulberry32; reproducible, not cryptographic. */
export function createSeededRandom(seed: string): RandomSource {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state = Math.imul(state ^ seed.charCodeAt(index), 16777619);
  }
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Returns a fresh shuffled array, leaving its input untouched. */
export function shuffled<T>(values: readonly T[], random: RandomSource): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    const value = result[index]!;
    result[index] = result[other]!;
    result[other] = value;
  }
  return result;
}
