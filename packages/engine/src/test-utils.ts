// Test helpers: build games with chosen hands and apply inputs with readable failures.
// Not exported from the package entry point.

import { expect } from "vitest";
import { applyInput, createGame } from "./game";
import { createDeck, type Role } from "./rules";
import { getPlayer } from "./state";
import {
  DEFAULT_TIMEOUTS,
  type EngineError,
  type GameConfig,
  type GameEvent,
  type GameState,
  type Input,
  type PlayerId,
} from "./types";

export const T0 = 1_000_000;

export interface SetupOptions {
  /** Hands in seating order. */
  hands: Record<PlayerId, Role[]>;
  coins?: Record<PlayerId, number>;
  /** Card indexes already face up (lost influence). */
  revealed?: Record<PlayerId, number[]>;
  /** Cards to place on top of the deck, in draw order. */
  deckTop?: Role[];
  first?: PlayerId;
  config?: Partial<Omit<GameConfig, "playerIds">>;
}

/** A game at the start of `first`'s turn with exactly the given hands. */
export function setup(options: SetupOptions): GameState {
  const ids = Object.keys(options.hands);
  const config: GameConfig = { playerIds: ids, ...DEFAULT_TIMEOUTS, ...options.config };
  const { state } = createGame(config, "test-seed", T0);

  const deck = createDeck();
  const take = (role: Role) => {
    const i = deck.indexOf(role);
    if (i < 0) throw new Error(`Setup uses more than 3 × ${role}`);
    deck.splice(i, 1);
  };
  for (const roles of Object.values(options.hands)) roles.forEach(take);
  const top = options.deckTop ?? [];
  top.forEach(take);

  state.players = ids.map((id) => ({
    id,
    coins: options.coins?.[id] ?? 2,
    cards: (options.hands[id] ?? []).map((role, i) => ({
      role,
      revealed: options.revealed?.[id]?.includes(i) ?? false,
    })),
  }));
  state.deck = [...top, ...deck];
  state.turn = { actorId: options.first ?? (ids[0] as PlayerId), action: null, block: null };
  state.phase = { kind: "AWAIT_ACTION", deadline: null };
  state.pending = [];
  return state;
}

/** Applies inputs in order, failing the test with the engine error if any is rejected. */
export function play(
  state: GameState,
  inputs: Input | Input[],
  now = T0,
): { state: GameState; events: GameEvent[] } {
  let current = state;
  const events: GameEvent[] = [];
  for (const input of Array.isArray(inputs) ? inputs : [inputs]) {
    const result = applyInput(current, input, now);
    if (!result.ok) {
      expect.fail(`${JSON.stringify(input)} rejected with ${result.error}`);
    }
    current = result.state;
    events.push(...result.events);
  }
  return { state: current, events };
}

/** Expects the input to be rejected and returns the error. */
export function reject(state: GameState, input: Input, now = T0): EngineError {
  const result = applyInput(state, input, now);
  if (result.ok) expect.fail(`${JSON.stringify(input)} was accepted`);
  return result.error;
}

export function coins(state: GameState, id: PlayerId): number {
  return getPlayer(state, id).coins;
}

export function revealedRoles(state: GameState, id: PlayerId): Role[] {
  return getPlayer(state, id)
    .cards.filter((c) => c.revealed)
    .map((c) => c.role);
}

export function hiddenCount(state: GameState, id: PlayerId): number {
  return getPlayer(state, id).cards.filter((c) => !c.revealed).length;
}

export function eventTypes(events: GameEvent[]): string[] {
  return events.map((e) => e.type);
}

// Input shorthands
export const declare = (
  playerId: PlayerId,
  action: Extract<Input, { type: "DECLARE" }>["action"],
  targetId?: PlayerId,
): Input =>
  targetId === undefined
    ? { type: "DECLARE", playerId, action }
    : { type: "DECLARE", playerId, action, targetId };
export const pass = (playerId: PlayerId): Input => ({ type: "PASS", playerId });
export const challenge = (playerId: PlayerId): Input => ({ type: "CHALLENGE", playerId });
export const block = (playerId: PlayerId, role: Role): Input => ({ type: "BLOCK", playerId, role });
export const loseCard = (playerId: PlayerId, cardIndex: number): Input => ({
  type: "CHOOSE_LOSS",
  playerId,
  cardIndex,
});
export const keep = (playerId: PlayerId, indexes: number[]): Input => ({
  type: "CHOOSE_EXCHANGE",
  playerId,
  keep: indexes,
});
export const pick = (playerId: PlayerId, deckIndex = 0): Input => ({
  type: "CHOOSE_REPLACEMENT",
  playerId,
  deckIndex,
});
export const TIMEOUT: Input = { type: "TIMEOUT" };
