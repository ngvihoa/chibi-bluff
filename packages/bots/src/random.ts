// Uniformly random legal play. A baseline for the simulator, not offered to players.

import { nextInt, nextRandom, type PlayerInput, type RngState } from "@chibi-bluff/engine";
import type { BotPolicy } from "./types";

export function pick<T>(items: readonly T[], rng: RngState): [T, RngState] {
  const [i, next] = nextInt(rng, items.length);
  return [items[i] as T, next];
}

export function chance(p: number, rng: RngState): [boolean, RngState] {
  const [roll, next] = nextRandom(rng);
  return [roll < p, next];
}

/** Picks an item with probability proportional to its weight (weights ≤ 0 are skipped). */
export function weightedPick<T>(
  items: readonly { item: T; weight: number }[],
  rng: RngState,
): [T, RngState] {
  const usable = items.filter((i) => i.weight > 0);
  const total = usable.reduce((sum, i) => sum + i.weight, 0);
  const [roll, next] = nextRandom(rng);
  let threshold = roll * total;
  for (const entry of usable) {
    threshold -= entry.weight;
    if (threshold < 0) return [entry.item, next];
  }
  const last = usable.at(-1);
  if (!last) throw new Error("weightedPick needs at least one positive weight");
  return [last.item, next];
}

export const randomBot: BotPolicy = {
  difficulty: "random",
  decide({ legal, rng }) {
    const [input, next] = pick<PlayerInput>(legal, rng);
    return { input, rng: next, thinkMs: 0 };
  },
};
