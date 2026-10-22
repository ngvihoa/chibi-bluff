// Read-only helpers over GameState shared by the engine, legal-move generation and views.

import { ACTION_RULES, type ActionRule, type Role } from "./rules";
import type { DeclaredAction, GameState, PlayerId, PlayerState } from "./types";

/** A player is in the game while they have at least one face-down card (R-IN-3). */
export function isAlive(player: PlayerState): boolean {
  return player.cards.some((card) => !card.revealed);
}

export function findPlayer(state: GameState, id: PlayerId): PlayerState | undefined {
  return state.players.find((p) => p.id === id);
}

export function getPlayer(state: GameState, id: PlayerId): PlayerState {
  const player = findPlayer(state, id);
  if (!player) throw new Error(`Unknown player ${id}`);
  return player;
}

export function alivePlayers(state: GameState): PlayerState[] {
  return state.players.filter(isAlive);
}

export function hiddenIndexes(player: PlayerState): number[] {
  return player.cards.flatMap((card, i) => (card.revealed ? [] : [i]));
}

export function hiddenRoles(player: PlayerState): Role[] {
  return player.cards.filter((card) => !card.revealed).map((card) => card.role);
}

export function hasHiddenRole(player: PlayerState, role: Role): boolean {
  return player.cards.some((card) => !card.revealed && card.role === role);
}

/** Next living player clockwise after `id` (R-SU-3). */
export function nextAliveAfter(state: GameState, id: PlayerId): PlayerId {
  const n = state.players.length;
  const start = state.players.findIndex((p) => p.id === id);
  for (let k = 1; k <= n; k++) {
    const candidate = state.players[(start + k) % n];
    if (candidate && isAlive(candidate)) return candidate.id;
  }
  return id;
}

export function currentAction(state: GameState): { action: DeclaredAction; rule: ActionRule } {
  const action = state.turn.action;
  if (!action) throw new Error("No action declared this turn");
  return { action, rule: ACTION_RULES[action.type] };
}

/** May `id` challenge the declared action right now? (R-CH-1) */
export function canChallengeAction(state: GameState, id: PlayerId): boolean {
  if (state.phase.kind !== "AWAIT_ACTION_RESPONSE" || !state.phase.allowChallenge) return false;
  const { action, rule } = currentAction(state);
  const player = findPlayer(state, id);
  return rule.claim !== null && id !== action.actorId && !!player && isAlive(player);
}

/** May `id` block the declared action (optionally with a specific role) right now? (R-BL-1) */
export function canBlockAction(state: GameState, id: PlayerId, role?: Role): boolean {
  if (state.phase.kind !== "AWAIT_ACTION_RESPONSE") return false;
  const { action, rule } = currentAction(state);
  const player = findPlayer(state, id);
  if (rule.blockers.length === 0 || id === action.actorId || !player || !isAlive(player)) {
    return false;
  }
  if (rule.blockableBy === "target" && id !== action.targetId) return false;
  return role === undefined || rule.blockers.includes(role);
}

/** Players who still have a say in the current response window. */
export function pendingResponders(state: GameState): PlayerId[] {
  const { phase } = state;
  if (phase.kind === "AWAIT_ACTION_RESPONSE") {
    return alivePlayers(state)
      .map((p) => p.id)
      .filter((id) => !phase.passed.includes(id))
      .filter((id) => canChallengeAction(state, id) || canBlockAction(state, id));
  }
  if (phase.kind === "AWAIT_BLOCK_RESPONSE") {
    const blockerId = state.turn.block?.blockerId;
    return alivePlayers(state)
      .map((p) => p.id)
      .filter((id) => id !== blockerId && !phase.passed.includes(id));
  }
  return [];
}
