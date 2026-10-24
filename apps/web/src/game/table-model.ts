// Pure helpers that turn a PlayerView + legal inputs into what the table shows.
// Kept free of React so they can be unit tested.

import {
  ACTION_RULES,
  ACTION_TYPES,
  type ActionType,
  type PlayerId,
  type PlayerInput,
  type PlayerView,
  type Role,
  RULES,
} from "@chibi-bluff/engine";

type Declare = Extract<PlayerInput, { type: "DECLARE" }>;

export type DisabledReason = "notYourTurn" | "needCoins" | "mustCoup";

export interface ActionButton {
  action: ActionType;
  cost: number;
  claim: Role | null;
  targeted: boolean;
  enabled: boolean;
  reason: DisabledReason | null;
  /** You would be claiming a character you do not hold (docs/ui-design.md §4.4). */
  bluff: boolean;
  /** Legal inputs for this action (one per target for targeted actions). */
  inputs: Declare[];
}

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

/** The seat the table should highlight as "acting now". */
export function activeSeat(view: PlayerView): PlayerId | null {
  const { phase } = view;
  switch (phase.kind) {
    case "AWAIT_INFLUENCE_LOSS":
    case "AWAIT_EXCHANGE":
      return phase.playerId;
    case "AWAIT_BLOCK_RESPONSE":
      return view.turn.block?.blockerId ?? view.turn.actorId;
    case "GAME_OVER":
      return phase.winnerId;
    default:
      return view.turn.actorId;
  }
}

/** The character currently being claimed on stage, and by whom. */
export function stageClaim(view: PlayerView): { playerId: PlayerId; role: Role } | null {
  const { phase, turn } = view;
  if (phase.kind === "AWAIT_BLOCK_RESPONSE" && turn.block) {
    return { playerId: turn.block.blockerId, role: turn.block.role };
  }
  if (phase.kind === "AWAIT_ACTION" || phase.kind === "GAME_OVER" || !turn.action) return null;
  const claim = ACTION_RULES[turn.action.type].claim;
  return claim ? { playerId: turn.action.actorId, role: claim } : null;
}
