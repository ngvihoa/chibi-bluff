// Pure helpers that turn a PlayerView + legal inputs into what the table shows.
// Kept free of React so they can be unit tested.

import {
  ACTION_RULES,
  ACTION_TYPES,
  type ActionType,
  type PlayerId,
  type PlayerInput,
  type PlayerView,
  ROLES,
  type Role,
  RULES,
} from "@chibi-bluff/engine";

type Declare = Extract<PlayerInput, { type: "DECLARE" }>;

export type DisabledReason = "notYourTurn" | "needCoins" | "mustCoup";

export interface ActionButton {
  action: ActionType;
  cost: number;
  /** Most coins the actor can gain (Steal takes up to 2). */
  gain: number;
  claim: Role | null;
  targeted: boolean;
  enabled: boolean;
  reason: DisabledReason | null;
  /** You would be claiming a character you do not hold (docs/ui-design.md §4.4). */
  bluff: boolean;
  /** Legal inputs for this action (one per target for targeted actions). */
  inputs: Declare[];
}

const GAINS: Partial<Record<ActionType, number>> = {
  income: RULES.INCOME_GAIN,
  foreignAid: RULES.FOREIGN_AID_GAIN,
  tax: RULES.TAX_GAIN,
  steal: RULES.STEAL_MAX,
};

/** All seven actions, always in the same order, each with whether and why it can be used. */
export function actionButtons(view: PlayerView, legal: PlayerInput[]): ActionButton[] {
  const me = view.players.find((p) => p.id === view.viewerId);
  const held = (me?.cards ?? []).flatMap((c) => (!c.revealed && c.role ? [c.role] : []));
  const myTurn = view.phase.kind === "AWAIT_ACTION" && view.turn.actorId === view.viewerId;
  const declares = legal.filter((i): i is Declare => i.type === "DECLARE");
  const coins = me?.coins ?? 0;

  return ACTION_TYPES.map((action) => {
    const rule = ACTION_RULES[action];
    const inputs = declares.filter((d) => d.action === action);
    let reason: DisabledReason | null = null;
    if (inputs.length === 0) {
      if (!myTurn) reason = "notYourTurn";
      else if (coins >= RULES.MUST_COUP_AT && action !== "coup") reason = "mustCoup";
      else reason = "needCoins";
    }
    return {
      action,
      cost: rule.cost,
      gain: GAINS[action] ?? 0,
      claim: rule.claim,
      targeted: rule.targeted,
      enabled: inputs.length > 0,
      reason,
      bluff: rule.claim !== null && !held.includes(rule.claim),
      inputs,
    };
  });
}

/** A player's card slots with stable keys (slots never reorder). */
export function cardSlots<T>(player: { id: PlayerId; cards: T[] }) {
  return player.cards.map((card, index) => ({ key: `${player.id}:${index}`, card, index }));
}

/**
 * While a won challenge's replacement is being picked (R-DG-8), the proven card is already
 * shuffled into the deck by the rules; the engine only keeps it in hand until the pick.
 * Returns the hand slot to draw as empty, or null. Opponents' backs all look alike, so any
 * face-down slot will do for them.
 */
export function returningSlot(view: PlayerView, playerId: PlayerId): number | null {
  const { phase } = view;
  if (phase.kind !== "AWAIT_REPLACEMENT" || phase.playerId !== playerId) return null;
  const cards = view.players.find((p) => p.id === playerId)?.cards ?? [];
  const exact = cards.findIndex((c) => !c.revealed && c.role === phase.role);
  const index = exact >= 0 ? exact : cards.findIndex((c) => !c.revealed);
  return index >= 0 ? index : null;
}

/** Cards in the court deck as the rules see it: the proven card counts while it is picked. */
export function deckCount(view: PlayerView): number {
  return view.deckSize + (view.phase.kind === "AWAIT_REPLACEMENT" ? 1 : 0);
}

/** The seat the table should highlight as "acting now". */
export function activeSeat(view: PlayerView): PlayerId | null {
  const { phase } = view;
  switch (phase.kind) {
    case "AWAIT_INFLUENCE_LOSS":
    case "AWAIT_EXCHANGE":
    case "AWAIT_REPLACEMENT":
      return phase.playerId;
    case "AWAIT_BLOCK_RESPONSE":
      return view.turn.block?.blockerId ?? view.turn.actorId;
    case "GAME_OVER":
      return phase.winnerId;
    default:
      return view.turn.actorId;
  }
}

/** How many copies of each character are face up on the table (public card counting). */
export function revealedCounts(view: PlayerView): Record<Role, number> {
  const counts = Object.fromEntries(ROLES.map((r) => [r, 0])) as Record<Role, number>;
  for (const p of view.players) for (const c of p.cards) if (c.revealed) counts[c.role] += 1;
  return counts;
}

/** The character currently being claimed on stage, and by whom. */
export function stageClaim(view: PlayerView): { playerId: PlayerId; role: Role } | null {
  const { phase, turn } = view;
  // R-DG-8: show the character just proven while its owner picks a replacement.
  if (phase.kind === "AWAIT_REPLACEMENT") return { playerId: phase.playerId, role: phase.role };
  if (phase.kind === "AWAIT_BLOCK_RESPONSE" && turn.block) {
    return { playerId: turn.block.blockerId, role: turn.block.role };
  }
  if (phase.kind === "AWAIT_ACTION" || phase.kind === "GAME_OVER" || !turn.action) return null;
  const claim = ACTION_RULES[turn.action.type].claim;
  return claim ? { playerId: turn.action.actorId, role: claim } : null;
}
