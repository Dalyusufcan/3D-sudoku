/** Seeds are also used in the URL; keep their syntax small and predictable. */
export function validSeed(value: string | null): value is string {
  return value !== null && /^[A-Za-z0-9_-]{1,48}$/.test(value);
}

export function freshSeed(): string {
  const words = crypto.getRandomValues(new Uint32Array(2));
  return Array.from(words, word => word.toString(36)).join('-');
}
