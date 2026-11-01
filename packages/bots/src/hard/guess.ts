// Guessing what this seat cannot see (docs/bot-ai.md §7.2): every other player's face-down cards
// and the deck order, weighted by the same beliefs the normal bot uses (§4). Each guess, together
// with the view, makes one imagined "world" to think ahead in.

import {
  nextRandom,
  type PlayerId,
  type PlayerView,
  type RngState,
  ROLES,
  type Role,
  shuffle,
  type WorldGuess,
} from "@chibi-bluff/engine";
import { claimOdds } from "../belief";
import type { BotMemory } from "../types";

type Counts = Record<Role, number>;

/** Copies of each character the viewer has not seen (in other hands, the deck, a draw). */
export function unseenPool(view: PlayerView): Counts {
  const counts = Object.fromEntries(ROLES.map((r) => [r, 3])) as Counts;
  for (const p of view.players) {
    for (const c of p.cards) {
      if (c.revealed || p.id === view.viewerId) counts[c.role as Role] -= 1;
    }
  }
  const { phase } = view;
  if (phase.kind === "AWAIT_EXCHANGE" && phase.playerId === view.viewerId && phase.options) {
    for (const role of phase.options.slice(phase.keepCount)) counts[role] -= 1;
  }
  return counts;
}

/** Cards a player is known to hold right now: a character they just proved, not yet replaced. */
function knownCards(view: PlayerView): Map<PlayerId, Role[]> {
  const known = new Map<PlayerId, Role[]>();
  const add = (id: PlayerId, role: Role) => {
    if (id === view.viewerId) return;
    const list = known.get(id) ?? [];
    if (!list.includes(role)) known.set(id, [...list, role]);
  };
  if (view.phase.kind === "AWAIT_REPLACEMENT") add(view.phase.playerId, view.phase.role);
  for (const step of view.pending) if (step.kind === "REPLACE_CARD") add(step.playerId, step.role);
  return known;
}

/** One guess at the hidden cards, drawn from the viewer's beliefs. */
export function guessWorld(
  view: PlayerView,
  memory: BotMemory,
  rng: RngState,
): [WorldGuess, RngState] {
  const pool = unseenPool(view);
  const known = knownCards(view);
  const take = (role: Role) => {
    pool[role] -= 1;
    return role;
  };
  // Claims on the table this turn are evidence too (the normal bot's "claiming now").
  const claimingNow = (id: PlayerId, role: Role) =>
    memory.openClaims.some((c) => c.playerId === id && c.role === role);

  const opponents = view.players.filter((p) => p.id !== view.viewerId);
  let order: PlayerId[];
  [order, rng] = shuffle(
    opponents.map((p) => p.id),
    rng,
  );
  const hands: Record<PlayerId, Role[]> = {};
  const slotsOf = (id: PlayerId) =>
    opponents.find((p) => p.id === id)?.cards.filter((c) => !c.revealed).length ?? 0;
  // Cards known for sure go first, before anyone else's guess can use up their copies.
  const sure = new Map(
    order.map((id) => [id, (known.get(id) ?? []).slice(0, slotsOf(id)).map(take)]),
  );
  for (const id of order) {
    const slots = slotsOf(id);
    const hand = sure.get(id) ?? [];
    while (hand.length < slots) {
      const weights = ROLES.map(
        (role) => pool[role] * claimOdds(memory, id, role, claimingNow(id, role)),
      );
      let roll: number;
      [roll, rng] = nextRandom(rng);
      hand.push(take(pick(weights, roll)));
    }
    // Card order does not matter to the player, but keep it random rather than by weight.
    [hands[id], rng] = shuffle(hand, rng);
  }

  let rest: Role[] = ROLES.flatMap((role) => Array.from({ length: pool[role] }, () => role));
  [rest, rng] = shuffle(rest, rng);
  const otherExchange =
    view.phase.kind === "AWAIT_EXCHANGE" && view.phase.playerId !== view.viewerId;
  const exchangeDrawn = otherExchange ? rest.splice(0, 2) : undefined;
  return [{ hands, deck: rest, exchangeDrawn }, rng];
}

function pick(weights: number[], roll: number): Role {
  const total = weights.reduce((a, b) => a + b, 0);
  let left = roll * total;
  for (let i = 0; i < weights.length; i++) {
    left -= weights[i] as number;
    if (left < 0 && (weights[i] as number) > 0) return ROLES[i] as Role;
  }
  // Rounding: the last character still available.
  for (let i = weights.length - 1; i >= 0; i--)
    if ((weights[i] as number) > 0) return ROLES[i] as Role;
  throw new Error("No card left to guess");
}
