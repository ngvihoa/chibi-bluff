// Easy bot (docs/bot-ai.md §6): mostly honest and mostly safe, no card counting.
// It plays the characters it holds, rarely bluffs, rarely challenges.

import {
  ACTION_RULES,
  type ActionType,
  nextRandom,
  type PlayerInput,
  type PlayerView,
  type RngState,
  type Role,
} from "@chibi-bluff/engine";
import { chance, pick, weightedPick } from "./random";
import type { BotContext, BotPolicy, Decision } from "./types";

type Declare = Extract<PlayerInput, { type: "DECLARE" }>;

/** Base weight of each action when the bot holds the character it needs. */
const HONEST_WEIGHT: Record<ActionType, number> = {
  income: 2,
  foreignAid: 2,
  coup: 6,
  tax: 5,
  assassinate: 4,
  steal: 4,
  exchange: 1.5,
};
const BLUFF_SCALE = 0.4;

export const easyBot: BotPolicy = {
  difficulty: "easy",
  decide(ctx) {
    const { view, legal } = ctx;
    const phase = view.phase.kind;
    if (phase === "AWAIT_ACTION") return chooseAction(ctx);
    if (phase === "AWAIT_ACTION_RESPONSE" || phase === "AWAIT_BLOCK_RESPONSE") {
      return respond(ctx);
    }
    // Card choices (lose / exchange): any legal option.
    const [input, rng] = pick(legal, ctx.rng);
    return think(input, rng, 600, 900);
  },
};

function myRoles(view: PlayerView): Role[] {
  const me = view.players.find((p) => p.id === view.viewerId);
  return (me?.cards ?? []).flatMap((c) => (!c.revealed && c.role ? [c.role] : []));
}

function coinsOf(view: PlayerView, id: string | undefined): number {
  return view.players.find((p) => p.id === id)?.coins ?? 0;
}

function chooseAction(ctx: BotContext): Decision {
  const { view, legal, personality } = ctx;
  const declares = legal.filter((i): i is Declare => i.type === "DECLARE");
  const held = myRoles(view);
  const types = [...new Set(declares.map((d) => d.action))];

  const weighted = types.map((action) => {
    const claim = ACTION_RULES[action].claim;
    const honest = claim === null || held.includes(claim);
    let weight = HONEST_WEIGHT[action] * (honest ? 1 : personality.bluffRate * BLUFF_SCALE);
    if (
      action === "steal" &&
      !declares.some((d) => d.action === "steal" && coinsOf(view, d.targetId) > 0)
    ) {
      weight = 0;
    }
    return { item: action, weight };
  });
  if (!weighted.some((w) => w.weight > 0))
    weighted.push({ item: types[0] as ActionType, weight: 1 });

  let rng = ctx.rng;
  let action: ActionType;
  [action, rng] = weightedPick(weighted, rng);
  const options = declares.filter((d) => d.action === action);
  // Steal from whoever has coins; otherwise any target.
  const preferred =
    action === "steal" ? options.filter((d) => coinsOf(view, d.targetId) > 0) : options;
  const [input, afterPick] = pick(preferred.length > 0 ? preferred : options, rng);
  return think(input, afterPick, 800, 1400);
}

function respond(ctx: BotContext): Decision {
  const { view, legal, personality } = ctx;
  let rng = ctx.rng;
  const passInput = legal.find((i) => i.type === "PASS");
  const challengeInput = legal.find((i) => i.type === "CHALLENGE");
  const blocks = legal.filter(
    (i): i is Extract<PlayerInput, { type: "BLOCK" }> => i.type === "BLOCK",
  );
  const held = myRoles(view);
  const action = view.turn.action;
  const targetedMe = action?.targetId === view.viewerId;
  const lastCard = held.length === 1;

  // Block truthfully whenever possible.
  const honestBlock = blocks.find((b) => held.includes(b.role));
  if (honestBlock) return think(honestBlock, rng, 700, 1200);

  // Facing an assassination on the last card: fight back somehow.
  if (targetedMe && action?.type === "assassinate" && lastCard) {
    const contessa = blocks.find((b) => b.role === "contessa");
    let bluff: boolean;
    [bluff, rng] = chance(0.5, rng);
    if (contessa && bluff) return think(contessa, rng, 1500, 2500);
    if (challengeInput) return think(challengeInput, rng, 1500, 2500);
  }

  if (blocks.length > 0 && targetedMe) {
    let bluffBlock: boolean;
    [bluffBlock, rng] = chance(personality.bluffRate * 0.2, rng);
    if (bluffBlock) {
      let b: (typeof blocks)[number];
      [b, rng] = pick(blocks, rng);
      return think(b, rng, 1200, 2000);
    }
  }

  if (challengeInput) {
    let doChallenge: boolean;
    [doChallenge, rng] = chance(0.05 + personality.aggression * 0.1 + (targetedMe ? 0.05 : 0), rng);
    if (doChallenge) return think(challengeInput, rng, 1200, 2200);
  }
  return think(passInput ?? (legal[0] as PlayerInput), rng, 600, 1100);
}

function think(input: PlayerInput, rng: RngState, minMs: number, maxMs: number): Decision {
  const [roll, next] = nextRandom(rng);
  return { input, rng: next, thinkMs: Math.round(minMs + roll * (maxMs - minMs)) };
}
