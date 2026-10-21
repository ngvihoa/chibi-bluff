import { describe, expect, it } from "vitest";
import { createRng, nextInt, nextRandom, type RngState, shuffle } from "./rng";

function take(state: RngState, n: number): number[] {
  const out: number[] = [];
  let rng = state;
  for (let i = 0; i < n; i++) {
    let value: number;
    [value, rng] = nextRandom(rng);
    out.push(value);
  }
  return out;
}

describe("rng", () => {
  it("produces the same sequence for the same seed", () => {
    expect(take(createRng("ván-1"), 20)).toEqual(take(createRng("ván-1"), 20));
  });

  it("produces different sequences for different seeds", () => {
    expect(take(createRng("seed-a"), 5)).not.toEqual(take(createRng("seed-b"), 5));
  });

  it("is pure: reusing a state yields the same value", () => {
    const rng = createRng("pure");
    expect(nextRandom(rng)[0]).toBe(nextRandom(rng)[0]);
  });

  it("returns floats in [0, 1)", () => {
    for (const v of take(createRng("range"), 10_000)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("state survives a JSON round trip", () => {
    const rng = createRng("json");
    const restored = JSON.parse(JSON.stringify(rng)) as RngState;
    expect(take(restored, 10)).toEqual(take(rng, 10));
  });

  it("nextInt stays within bounds and rejects invalid bounds", () => {
    let rng = createRng("int");
    const seen = new Set<number>();
    for (let i = 0; i < 1_000; i++) {
      let v: number;
      [v, rng] = nextInt(rng, 6);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(() => nextInt(rng, 0)).toThrow(RangeError);
    expect(() => nextInt(rng, 2.5)).toThrow(RangeError);
  });
});

describe("shuffle", () => {
  it("returns a permutation and does not mutate the input", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const [result] = shuffle(input, createRng("perm"));
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...result].sort()).toEqual(input);
  });

  it("is deterministic for the same seed", () => {
    const items = ["a", "b", "c", "d", "e"];
    expect(shuffle(items, createRng("same"))[0]).toEqual(shuffle(items, createRng("same"))[0]);
  });

  it("is roughly uniform over permutations", () => {
    const counts = new Map<string, number>();
    let rng = createRng("uniform");
    const runs = 6_000;
    for (let i = 0; i < runs; i++) {
      let result: number[];
      [result, rng] = shuffle([0, 1, 2], rng);
      const key = result.join("");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(6);
    for (const count of counts.values()) {
      // Expected 1000 each; ±15% is far outside normal variance for this sample size.
      expect(count).toBeGreaterThan(850);
      expect(count).toBeLessThan(1150);
    }
  });
});
