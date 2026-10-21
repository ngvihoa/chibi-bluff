// Seeded, serialisable PRNG (sfc32 seeded via cyrb128). Pure: every call returns the next state
// instead of mutating, so the RNG can live inside GameState and replays are exact.

export interface RngState {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
}

export function createRng(seed: string): RngState {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  let state: RngState = { a: h1 >>> 0, b: h2 >>> 0, c: h3 >>> 0, d: h4 >>> 0 };
  // Discard a few outputs so similar seeds diverge quickly.
  for (let i = 0; i < 15; i++) state = nextRandom(state)[1];
  return state;
}

/** Returns a float in [0, 1) and the next state. */
export function nextRandom(state: RngState): [number, RngState] {
  let { a, b, c, d } = state;
  const t = (((a + b) | 0) + d) | 0;
  d = (d + 1) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  c = (c + t) | 0;
  return [(t >>> 0) / 4294967296, { a: a >>> 0, b: b >>> 0, c: c >>> 0, d: d >>> 0 }];
}

/** Returns an integer in [0, maxExclusive) and the next state. */
export function nextInt(state: RngState, maxExclusive: number): [number, RngState] {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new RangeError(`maxExclusive must be a positive integer, got ${maxExclusive}`);
  }
  const [value, next] = nextRandom(state);
  return [Math.floor(value * maxExclusive), next];
}

/** Fisher–Yates shuffle. Returns a new array; the input is not modified. */
export function shuffle<T>(items: readonly T[], state: RngState): [T[], RngState] {
  const result = items.slice();
  let rng = state;
  for (let i = result.length - 1; i > 0; i--) {
    let j: number;
    [j, rng] = nextInt(rng, i + 1);
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return [result, rng];
}
