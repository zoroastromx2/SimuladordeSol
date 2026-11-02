import { describe, expect, it } from 'vitest';
import {
  halton,
  halton2,
  halton3,
  haltonPair,
  radicalInverse,
} from '../src/math/Halton';

const first = (count, generator) =>
  Array.from({ length: count }, (_, index) => generator(index + 1));

const quartileCounts = (values) => {
  const counts = [0, 0, 0, 0];
  for (const value of values) {
    counts[Math.min(3, Math.floor(value * 4))] += 1;
  }
  return counts;
};

describe('Halton sequence', () => {
  it('uses the conventional one-based radical inverse', () => {
    expect(halton(1, 2)).toBe(0.5);
    expect(halton(2, 2)).toBe(0.25);
    expect(halton(1, 3)).toBeCloseTo(1 / 3, 12);
    expect(radicalInverse(16, 2)).toBe(1 / 32);
  });

  it.each([
    ['base 2', 2],
    ['base 3', 3],
  ])('is uniformly distributed across the first 16 values in %s', (_, base) => {
    const values = first(16, (index) => halton(index, base));

    expect(values).toHaveLength(16);
    expect(new Set(values).size).toBe(16);
    expect(values.every((value) => value > 0 && value < 1)).toBe(true);
    expect(quartileCounts(values).every((count) => count >= 3 && count <= 5)).toBe(
      true,
    );
    expect(
      Math.abs(values.reduce((sum, value) => sum + value, 0) / values.length - 0.5),
    ).toBeLessThan(0.05);
    expect(Math.min(...values)).toBeLessThan(0.1);
    expect(Math.max(...values)).toBeGreaterThan(0.8);
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.8);
  });

  it('offsets frames with decorrelated base-2 and base-3 values', () => {
    expect(haltonPair(1)).toEqual([halton2(1), halton3(1)]);
    expect(halton2(7)).toBe(halton(7, 2));
    expect(halton3(7)).toBe(halton(7, 3));

    const pairs = first(16, haltonPair);
    expect(new Set(pairs.map(([x, y]) => `${x}:${y}`)).size).toBe(16);
    expect(pairs[0]).not.toEqual(pairs[1]);
  });

  it('is deterministic', () => {
    expect(first(32, (index) => halton(index, 3))).toEqual(
      first(32, (index) => halton(index, 3)),
    );
  });

  it('rejects non-positive indices and invalid bases', () => {
    expect(() => halton(0, 2)).toThrow(RangeError);
    expect(() => halton(1.5, 2)).toThrow(RangeError);
    expect(() => halton(1, 1)).toThrow(RangeError);
    expect(() => halton(1, 2.5)).toThrow(RangeError);
  });
});
