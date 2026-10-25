// Normal bot (docs/bot-ai.md §5): card counting + belief model + expected value, chosen by softmax.
// All values are in "coin" units so actions, card losses and risks can be compared directly.

import {
  ACTION_RULES,
  type ActionType,
  nextRandom,
  type PlayerId,
  type PlayerInput,
  type PlayerView,
  type PlayerViewPlayer,
  type RngState,
  ROLES,
  type Role,
  RULES,
} from "@chibi-bluff/engine";
import { probabilityHolds, unseenCounts } from "./belief";
import type { BotContext, BotPolicy, Decision } from "./types";

type Declare = Extract<PlayerInput, { type: "DECLARE" }>;
type Block = Extract<PlayerInput, { type: "BLOCK" }>;

/** Softmax temperature τ (§6). Lower = more decisive. */
const TEMPERATURE = 1;

export const normalBot: BotPolicy = {
  difficulty: "normal",
  decide(ctx) {
    switch (ctx.view.phase.kind) {
      case "AWAIT_ACTION":
        return chooseAction(ctx);
      case "AWAIT_ACTION_RESPONSE":
        return respondToAction(ctx);
      case "AWAIT_BLOCK_RESPONSE":
        return respondToBlock(ctx);
      case "AWAIT_INFLUENCE_LOSS":
        return chooseLoss(ctx);
      case "AWAIT_EXCHANGE":
        return chooseExchange(ctx);
      case "AWAIT_REPLACEMENT": {
        // R-DG-8: every face-down card is equally unknown; just pick one.
        const [roll, rng] = nextRandom(ctx.rng);
        const input = ctx.legal[Math.floor(roll * ctx.legal.length)] as PlayerInput;
        return think(input, rng, 500, 900);
      }
      default:
        return think(ctx.legal[0] as PlayerInput, ctx.rng, 500, 800);
    }
  },
};

// ---------- Situation helpers ----------

interface Situation {
  view: PlayerView;
  me: PlayerViewPlayer;
  held: Role[];
  lives: number;
  opponents: PlayerViewPlayer[];
  revealed: Record<Role, number>;
  unseen: Record<Role, number>;
  prob: (id: PlayerId, role: Role, claimingNow?: boolean) => number;
  /** Observed share of chances this player used to challenge (with a prior of 1 in 8). */
  challengeRate: (id: PlayerId) => number;
}

function situation(ctx: BotContext): Situation {
  const { view, memory } = ctx;
  const me = view.players.find((p) => p.id === view.viewerId) as PlayerViewPlayer;
  const held = me.cards.flatMap((c) => (!c.revealed && c.role ? [c.role] : []));
  const revealed = Object.fromEntries(ROLES.map((r) => [r, 0])) as Record<Role, number>;
  for (const p of view.players) for (const c of p.cards) if (c.revealed) revealed[c.role] += 1;
  return {
    view,
    me,
    held,
    lives: held.length,
    opponents: view.players.filter((p) => p.id !== me.id && !p.eliminated),
    revealed,
    unseen: unseenCounts(view),
    prob: (id, role, claimingNow = false) =>
      probabilityHolds(view, memory, id, role, { claimingNow }),
    challengeRate: (id) => {
      const r = memory.players[id];
      const rate = ((r?.challengesMade ?? 0) + 1) / ((r?.challengeChances ?? 0) + 8);
      return Math.min(0.6, Math.max(0.03, rate));
    },
  };
}

const livesOf = (p: PlayerViewPlayer) => p.cards.filter((c) => !c.revealed).length;
const player = (s: Situation, id: PlayerId | null | undefined) =>
  s.view.players.find((p) => p.id === id);

/** What losing one of my cards costs me (§5.1). */
const myCardValue = (s: Situation) => (s.lives <= 1 ? 30 : 8);

/** How much I gain when opponent `o` loses a card. */
function hitValue(ctx: BotContext, o: PlayerViewPlayer): number {
  const grudge = (ctx.memory.grudges[o.id] ?? 0) * ctx.personality.vindictive;
  const nearCoup = o.coins >= RULES.MUST_COUP_AT - 3 ? 3 : 0;
  return (livesOf(o) === 1 ? 17 : 11) + o.coins * 0.4 + nearCoup + Math.min(3, grudge);
}

/**
 * Chance that someone challenges me if I claim `role` without holding it. The target of an attack
 * pushes back harder, and a target on its last card facing assassination has nothing to lose.
 */
function caughtChance(
  s: Situation,
  role: Role,
  attack?: { targetId: PlayerId; type: ActionType },
): number {
  if (s.held.includes(role)) return 0;
  const exposure = 1 + 0.7 * s.revealed[role];
  let safe = 1;
  for (const o of s.opponents) {
    let rate = s.challengeRate(o.id) * exposure;
    if (attack?.targetId === o.id) {
      rate *= 2;
      if (attack.type === "assassinate" && livesOf(o) === 1) rate = Math.max(rate, 0.6);
    }
    safe *= 1 - Math.min(0.9, rate);
  }
  return 1 - safe;
}

// ---------- Choosing an action ----------

function chooseAction(ctx: BotContext): Decision {
  const s = situation(ctx);
  const declares = ctx.legal.filter((i): i is Declare => i.type === "DECLARE");
  const scored = declares.map((input) => ({ input, ev: actionValue(ctx, s, input) }));
  const [input, rng] = softmax(scored, ctx.rng);
  return think(input, rng, 900, 1700);
}

function actionValue(ctx: BotContext, s: Situation, input: Declare): number {
  const rule = ACTION_RULES[input.action];
  const target = player(s, input.targetId);
  const bluffing = rule.claim !== null && !s.held.includes(rule.claim);
  const attack = target ? { targetId: target.id, type: input.action } : undefined;
  const bluffRisk = rule.claim ? caughtChance(s, rule.claim, attack) * myCardValue(s) : 0;
  // Personality: some bots enjoy bluffing a little more than the maths says.
  const bluffTaste = bluffing ? (ctx.personality.bluffRate - 0.35) * 2 : 0;

  const anyoneBlocks = (role: Role) => {
    let none = 1;
    for (const o of s.opponents) none *= 1 - (s.prob(o.id, role) * 0.9 + 0.03);
    return 1 - none;
  };
  const targetBlocks = (o: PlayerViewPlayer) => {
    let none = 1;
    for (const role of rule.blockers) none *= 1 - s.prob(o.id, role) * 0.9;
    // A target on its last card will block (bluff or not) far more readily.
    const desperate = livesOf(o) === 1 && input.action === "assassinate" ? 0.4 : 0;
    return 1 - none * (1 - desperate);
  };

  let value: number;
  switch (input.action as ActionType) {
    case "income":
      value = RULES.INCOME_GAIN;
      break;
    case "foreignAid":
      value = RULES.FOREIGN_AID_GAIN * (1 - anyoneBlocks("duke"));
      break;
    case "tax":
      value = RULES.TAX_GAIN;
      break;
    case "steal": {
      if (!target) return -99;
      const gain = Math.min(RULES.STEAL_MAX, target.coins);
      value = gain * 1.6 * (1 - targetBlocks(target));
      break;
    }
    case "assassinate":
      if (!target) return -99;
      value = hitValue(ctx, target) * (1 - targetBlocks(target)) - rule.cost;
      break;
    case "coup":
      if (!target) return -99;
      value = hitValue(ctx, target) - rule.cost + 2;
      break;
    case "exchange": {
      const strong = s.held.some((r) => r === "duke" || r === "assassin" || r === "captain");
      value = strong ? 0.3 : 1.8;
      break;
    }
  }
  return value - (bluffing ? bluffRisk : 0) + bluffTaste;
}

// ---------- Responding to an action ----------

function respondToAction(ctx: BotContext): Decision {
  const s = situation(ctx);
  const action = s.view.turn.action;
  const pass = ctx.legal.find((i) => i.type === "PASS") as PlayerInput;
  if (!action) return think(pass, ctx.rng, 500, 900);

  const actor = player(s, action.actorId) as PlayerViewPlayer;
  const rule = ACTION_RULES[action.type];
  const targetedMe = action.targetId === s.me.id;
  const damage = damageToMe(s, action.type, actor, targetedMe);
  const challengeInput = ctx.legal.find((i) => i.type === "CHALLENGE");
  const blocks = ctx.legal.filter((i): i is Block => i.type === "BLOCK");

  // 1. Block truthfully when we can.
  const honest = blocks.find((b) => s.held.includes(b.role));
  if (honest) return think(honest, ctx.rng, 700, 1300);

  const pLie = rule.claim ? 1 - s.prob(actor.id, rule.claim, true) : 0;

  // 2. Assassinated on the last card: pick the line with the best survival odds.
  if (targetedMe && action.type === "assassinate" && s.lives === 1) {
    const contessa = blocks.find((b) => b.role === "contessa");
    const surviveBluff = contessa ? 1 - caughtChance(s, "contessa") : 0;
    const surviveChallenge = challengeInput ? pLie : 0;
    if (contessa && surviveBluff >= surviveChallenge) return think(contessa, ctx.rng, 1800, 2500);
    if (challengeInput && surviveChallenge > 0) return think(challengeInput, ctx.rng, 1800, 2500);
  }

  // 3. Challenge when it pays off (§5.4). Certain lies are always challenged.
  if (challengeInput && rule.claim) {
    if (s.unseen[rule.claim] === 0) return think(challengeInput, ctx.rng, 1000, 1600);
    const gainIfRight = damage + hitValue(ctx, actor) * (targetedMe ? 0.5 : 0.3);
    const ev = pLie * gainIfRight - (1 - pLie) * myCardValue(s);
    const threshold = 3.5 - ctx.personality.aggression * 2;
    if (ev > threshold) return think(challengeInput, ctx.rng, 1400, 2400);
  }

  // 4. Bluff a block when the damage avoided outweighs the risk (§5.5).
  for (const b of blocks) {
    const risk = caughtChance(s, b.role);
    const ev = damage * (1 - risk) - risk * myCardValue(s) + (ctx.personality.bluffRate - 0.35) * 2;
    if (ev > 1) return think(b, ctx.rng, 1300, 2200);
  }

  return think(pass, ctx.rng, 600, 1200);
}

/** How much the action hurts me if it goes through. */
function damageToMe(
  s: Situation,
  type: ActionType,
  actor: PlayerViewPlayer,
  targetedMe: boolean,
): number {
  const fedCoins = (gain: number) =>
    gain * 0.3 + (actor.coins < 7 && actor.coins + gain >= 7 ? 2 : 0);
  switch (type) {
    case "assassinate":
      return targetedMe ? myCardValue(s) : 1;
    case "steal":
      return targetedMe ? Math.min(RULES.STEAL_MAX, s.me.coins) * 1.6 : 0.3;
    case "tax":
      return fedCoins(RULES.TAX_GAIN);
    case "foreignAid":
      return fedCoins(RULES.FOREIGN_AID_GAIN);
    case "exchange":
      return 0.3;
    default:
      return 0;
  }
}

// ---------- Responding to a block ----------

function respondToBlock(ctx: BotContext): Decision {
  const s = situation(ctx);
  const pass = ctx.legal.find((i) => i.type === "PASS") as PlayerInput;
  const challengeInput = ctx.legal.find((i) => i.type === "CHALLENGE");
  const block = s.view.turn.block;
  const action = s.view.turn.action;
  if (!challengeInput || !block || !action) return think(pass, ctx.rng, 500, 1000);

  if (s.unseen[block.role] === 0) return think(challengeInput, ctx.rng, 1000, 1600);
  const blocker = player(s, block.blockerId) as PlayerViewPlayer;
  const pLie = 1 - s.prob(blocker.id, block.role, true);
  const iAmActor = action.actorId === s.me.id;
  const target = player(s, action.targetId);
  let gain = hitValue(ctx, blocker) * 0.3;
  if (iAmActor) {
    if (action.type === "assassinate" && target) gain += hitValue(ctx, target);
    else if (action.type === "steal" && target) gain += Math.min(2, target.coins) * 1.6;
    else if (action.type === "foreignAid") gain += RULES.FOREIGN_AID_GAIN;
  }
  const ev = pLie * gain - (1 - pLie) * myCardValue(s);
  const threshold = 3.5 - ctx.personality.aggression * 2;
  if (ev > threshold) return think(challengeInput, ctx.rng, 1400, 2400);
  return think(pass, ctx.rng, 600, 1200);
}

// ---------- Card choices (§5.6) ----------

function cardScore(ctx: BotContext, s: Situation, role: Role): number {
  const { memory } = ctx;
  const richOpponent = s.opponents.some((o) => o.coins >= ACTION_RULES.assassinate.cost);
  const assassinClaimed = s.opponents.some((o) => (memory.players[o.id]?.claims.assassin ?? 0) > 0);
  let score = 1;
  switch (role) {
    case "contessa":
      score += (richOpponent ? 2 : 0.5) + (assassinClaimed ? 1.5 : 0);
      break;
    case "duke":
      score += s.me.coins < 5 ? 2.5 : 1.5;
      break;
    case "captain":
      score += 1.5;
      break;
    case "assassin":
      score += s.me.coins >= 3 ? 2.5 : 1.5;
      break;
    case "ambassador":
      score += 0.8;
      break;
  }
  // Keep the cards I have claimed so my story stays consistent.
  if ((memory.players[s.me.id]?.claims[role] ?? 0) > 0) score += 2;
  return score;
}

function chooseLoss(ctx: BotContext): Decision {
  const s = situation(ctx);
  let best = ctx.legal[0] as PlayerInput;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const input of ctx.legal) {
    if (input.type !== "CHOOSE_LOSS") continue;
    const role = s.me.cards[input.cardIndex]?.role;
    const score = role ? cardScore(ctx, s, role) : 0;
    if (score < bestScore) {
      bestScore = score;
      best = input;
    }
  }
  return think(best, ctx.rng, 900, 1600);
}

function chooseExchange(ctx: BotContext): Decision {
  const s = situation(ctx);
  const phase = s.view.phase;
  const options = phase.kind === "AWAIT_EXCHANGE" ? (phase.options ?? []) : [];
  let best = ctx.legal[0] as PlayerInput;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const input of ctx.legal) {
    if (input.type !== "CHOOSE_EXCHANGE") continue;
    const roles = input.keep.map((i) => options[i]).filter((r): r is Role => r !== undefined);
    const diversity = new Set(roles).size === roles.length ? 1 : 0;
    const score = roles.reduce((sum, r) => sum + cardScore(ctx, s, r), 0) + diversity;
    if (score > bestScore) {
      bestScore = score;
      best = input;
    }
  }
  return think(best, ctx.rng, 1200, 2000);
}

// ---------- Utilities ----------

function softmax<T>(scored: { input: T; ev: number }[], rng: RngState): [T, RngState] {
  const max = Math.max(...scored.map((x) => x.ev));
  const weights = scored.map((x) => Math.exp((x.ev - max) / TEMPERATURE));
  const total = weights.reduce((a, b) => a + b, 0);
  const [roll, next] = nextRandom(rng);
  let threshold = roll * total;
  for (let i = 0; i < scored.length; i++) {
    threshold -= weights[i] as number;
    if (threshold < 0) return [(scored[i] as { input: T }).input, next];
  }
  return [(scored.at(-1) as { input: T }).input, next];
}

function think(input: PlayerInput, rng: RngState, minMs: number, maxMs: number): Decision {
  const [roll, next] = nextRandom(rng);
  return { input, rng: next, thinkMs: Math.round(minMs + roll * (maxMs - minMs)) };
}
