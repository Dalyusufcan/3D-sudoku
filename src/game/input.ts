import { SIZE, toCoordinates, toIndex } from '../core/cube.ts';

/** Logical coordinates, independent of the camera. First movement selects the origin cell. */
export function selectionForKey(selected: number | null, key: string): number | null | undefined {
  const aliases: Record<string, string> = { a: 'ArrowLeft', d: 'ArrowRight', w: 'ArrowUp', s: 'ArrowDown', q: '[', e: ']' };
  key = aliases[key.toLowerCase()] ?? key;
  if (key === 'Escape') return null;
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '[', ']'].includes(key)) {
    return undefined;
  }
  if (selected === null) return 0;
  const { x, y, z } = toCoordinates(selected);
  const clamp = (value: number): number => Math.max(0, Math.min(SIZE - 1, value));
  switch (key) {
    case 'ArrowLeft': return toIndex({ x: clamp(x - 1), y, z });
    case 'ArrowRight': return toIndex({ x: clamp(x + 1), y, z });
    case 'ArrowUp': return toIndex({ x, y: clamp(y + 1), z });
    case 'ArrowDown': return toIndex({ x, y: clamp(y - 1), z });
    case '[': return toIndex({ x, y, z: clamp(z - 1) });
    case ']': return toIndex({ x, y, z: clamp(z + 1) });
    default: return undefined;
  }
}
