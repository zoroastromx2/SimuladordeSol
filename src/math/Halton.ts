const assertIntegerSequence = (index: number, base: number): void => {
  if (!Number.isInteger(index) || index < 1) {
    throw new RangeError('Halton index must be a positive integer.');
  }

  if (!Number.isInteger(base) || base < 2) {
    throw new RangeError('Halton base must be an integer greater than one.');
  }
};

/**
 * Returns the radical-inverse value of `index` in the given base.
 * Halton indices are one-based so the origin is never sampled.
 */
export function radicalInverse(index: number, base: number): number {
  assertIntegerSequence(index, base);

  let value = 0;
  let fraction = 1 / base;
  let remaining = index;

  while (remaining > 0) {
    value += (remaining % base) * fraction;
    remaining = Math.floor(remaining / base);
    fraction /= base;
  }

  return value;
}

export function halton(index: number, base = 2): number {
  return radicalInverse(index, base);
}

export function halton2(index: number): number {
  return radicalInverse(index, 2);
}

export function halton3(index: number): number {
  return radicalInverse(index, 3);
}

/** A decorrelated 2D sample pair using the configured bases. */
export function haltonPair(index: number): [number, number] {
  return [halton2(index), halton3(index)];
}
