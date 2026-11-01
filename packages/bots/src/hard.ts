// Hard bot (docs/bot-ai.md §7): thinks ahead in imagined worlds built from its own view. PIMC
// won the comparison with ISMCTS at the same time budget (§7.5), so it is the default; ISMCTS stays
// for the simulator. Only offered against bots, not in online rooms: each move thinks ~250 ms.

import {
  ACTION_RULES,
  nextRandom,
  type PlayerInput,
  type PlayerViewPlayer,
  type Role,
} from "@chibi-bluff/engine";
import { inputKey, ismcts, pimc, type SearchOptions } from "./hard/search";
import type { BotContext, BotPolicy, Decision } from "./types";

export type HardAlgorithm = "ismcts" | "pimc";

export interface HardBotOptions extends Partial<SearchOptions> {
  algorithm?: HardAlgorithm;
}

const DEFAULTS: SearchOptions = {
  timeMs: 250,
  maxIterations: Number.POSITIVE_INFINITY,
  rolloutTurns: 6,
  now: () => performance.now(),
};

/** How strongly personality tilts the final pick between close moves (§7.4). */
const PERSONALITY_TILT = 0.08;

export function createHardBot(options: HardBotOptions = {}): BotPolicy {
  const search = { ...DEFAULTS, ...options };
  const algorithm = options.algorithm ?? "pimc";
  return {
    difficulty: "hard",
    decide(ctx) {
      const { legal } = ctx;
      // One move (a forced pick, a lone pass): nothing to think about.
      if (legal.length === 1) return think(legal[0] as PlayerInput, ctx, 500, 900);
      const run = algorithm === "ismcts" ? ismcts : pimc;
      const result = run(ctx.view, ctx.memory, legal, ctx.rng, search);
      const tilt = personalityTilt(ctx);
      let best: PlayerInput = legal[0] as PlayerInput;
      let bestValue = -Infinity;
      for (const input of legal) {
        const s = result.stats.get(inputKey(input));
        if (!s || s.visits === 0) continue;
        // ISMCTS trusts visits (the robust child); PIMC compares mean scores.
        const base = algorithm === "ismcts" ? s.visits / result.iterations : s.mean;
        const value = base * (1 + tilt(input));
        if (value > bestValue) {
          bestValue = value;
          best = input;
        }
      }
      return think(best, { ...ctx, rng: result.rng }, 700, 1500);
    },
  };
}

export const hardBot = createHardBot();

/** Bluffers lean to bluffs, aggressive bots to challenges; cautious ones the other way. */
function personalityTilt(ctx: BotContext): (input: PlayerInput) => number {
  const me = ctx.view.players.find((p) => p.id === ctx.view.viewerId) as PlayerViewPlayer;
  const mine = me.cards.flatMap((c) => (!c.revealed && c.role ? [c.role] : [])) as Role[];
  const { bluffRate, aggression } = ctx.personality;
  return (input) => {
    const claim =
      input.type === "DECLARE"
        ? ACTION_RULES[input.action].claim
        : input.type === "BLOCK"
          ? input.role
          : null;
    if (claim && !mine.includes(claim)) return (bluffRate - 0.5) * PERSONALITY_TILT;
    if (input.type === "CHALLENGE") return (aggression - 0.5) * PERSONALITY_TILT;
    return 0;
  };
}

function think(input: PlayerInput, ctx: BotContext, min: number, max: number): Decision {
  const [roll, rng] = nextRandom(ctx.rng);
  return { input, rng, thinkMs: Math.round(min + roll * (max - min)) };
}
