// Property-style tests: thousands of random but legal games must never break the invariants.

import { describe, expect, it } from "vitest";
import { applyInput, createGame } from "./game";
import { getLegalInputs } from "./legal";
import { createRng, nextInt, nextRandom, type RngState } from "./rng";
import { createDeck, type Role } from "./rules";
import { alivePlayers, isAlive } from "./state";
import { DEFAULT_TIMEOUTS, type GameState, type Input } from "./types";
import { getEventsForViewer, getPlayerView } from "./view";

const IDS = ["an", "binh", "chi", "dung", "giang", "hoa"];
const MAX_STEPS = 3_000;

interface Playout {
  final: GameState;
  inputs: { input: Input; now: number }[];
  steps: number;
}

/** Plays a random game. `onStep` runs after every accepted input. */
function randomPlayout(
  seed: string,
  players: number,
  onStep: (state: GameState, input: Input, now: number) => void = () => {},
): Playout {
  let { state } = createGame(
    { playerIds: IDS.slice(0, players), ...DEFAULT_TIMEOUTS, actionTimeoutMs: 20_000 },
    seed,
    0,
  );
  let rng: RngState = createRng(`picker-${seed}`);
  let now = 0;
  const inputs: Playout["inputs"] = [];

  let steps = 0;
  for (; steps < MAX_STEPS && state.phase.kind !== "GAME_OVER"; steps++) {
    const legal = state.players.flatMap((p) => getLegalInputs(state, p.id));
    let roll: number;
    [roll, rng] = nextRandom(rng);
    let input: Input;
    if (legal.length === 0 || roll < 0.05) {
      // Occasionally let the clock run out instead.
      input = { type: "TIMEOUT" };
      now = state.phase.deadline ?? now;
      if (state.phase.deadline === null) {
        expect(legal.length).toBeGreaterThan(0);
        continue;
      }
    } else {
      let pick: number;
      [pick, rng] = nextInt(rng, legal.length);
      input = legal[pick] as Input;
    }
    now += 1;
    const result = applyInput(state, input, now);
    if (!result.ok) {
      throw new Error(`Legal input rejected (${result.error}): ${JSON.stringify(input)}`);
    }
    state = result.state;
    inputs.push({ input, now });
    onStep(state, input, now);
  }
  return { final: state, inputs, steps };
}

function checkInvariants(state: GameState): void {
  // 15 cards, 3 per role, always — including cards held during an exchange.
  const drawn =
    state.phase.kind === "AWAIT_EXCHANGE" ? state.phase.options.slice(state.phase.keepCount) : [];
  const all: Role[] = [
    ...state.deck,
    ...drawn,
    ...state.players.flatMap((p) => p.cards.map((c) => c.role)),
  ];
  expect(all.sort()).toEqual(createDeck().sort());

  for (const p of state.players) {
    expect(p.coins).toBeGreaterThanOrEqual(0);
    expect(p.cards).toHaveLength(2);
    if (!isAlive(p)) expect(p.coins).toBe(0);
  }

  const alive = alivePlayers(state);
  if (state.phase.kind === "GAME_OVER") {
    expect(alive.map((p) => p.id)).toEqual([state.phase.winnerId]);
  } else {
    expect(alive.length).toBeGreaterThanOrEqual(2);
  }
  if (state.phase.kind === "AWAIT_ACTION") {
    // A turn always starts with a living player. (Mid-turn the actor may already be out, e.g.
    // after losing a challenge against a block while the blocker picks a replacement.)
    expect(alive.some((p) => p.id === state.turn.actorId)).toBe(true);
    expect(state.pending).toEqual([]);
    expect(state.turn.action).toBeNull();
  }
  if (state.phase.kind === "AWAIT_REPLACEMENT") {
    expect(state.phase.choices).toBe(state.deck.length + 1);
  }
}

function checkViews(state: GameState): void {
  for (const viewer of [...state.players.map((p) => p.id), null]) {
    const view = getPlayerView(state, viewer);
    for (const p of view.players) {
      for (const card of p.cards) {
        if (!card.revealed && p.id !== viewer) expect(card.role).toBeNull();
      }
    }
  }
}

describe("random playouts", () => {
  it.each([2, 3, 4, 5, 6])("%i players: every game ends and invariants always hold", (n) => {
    for (let g = 0; g < 60; g++) {
      const { final, steps } = randomPlayout(`inv-${n}-${g}`, n, (state) => {
        checkInvariants(state);
        checkViews(state);
      });
      expect(steps).toBeLessThan(MAX_STEPS);
      expect(final.phase.kind).toBe("GAME_OVER");
    }
  });

  it("every input from getLegalInputs is accepted", () => {
    for (let g = 0; g < 25; g++) {
      randomPlayout(`legal-${g}`, 2 + (g % 5), (state, _input, now) => {
        for (const p of state.players) {
          for (const input of getLegalInputs(state, p.id)) {
            const result = applyInput(state, input, now);
            if (!result.ok) {
              throw new Error(`${result.error} for legal ${JSON.stringify(input)}`);
            }
          }
        }
      });
    }
  });

  it("redacted events never leak another player's private cards", () => {
    // Replay a game and inspect every event batch from each seat's point of view.
    const { inputs } = randomPlayout("leaks-2", 5);
    let { state } = createGame(
      { playerIds: IDS.slice(0, 5), ...DEFAULT_TIMEOUTS, actionTimeoutMs: 20_000 },
      "leaks-2",
      0,
    );
    for (const { input, now } of inputs) {
      const result = applyInput(state, input, now);
      if (!result.ok) throw new Error(result.error);
      for (const viewer of IDS.slice(0, 5)) {
        for (const event of getEventsForViewer(result.events, viewer)) {
          if (event.type === "CARD_REPLACED" && event.playerId !== viewer) {
            expect(event.newRole).toBeNull();
          }
          if (event.type === "EXCHANGE_STARTED" && event.playerId !== viewer) {
            expect(event.drawn).toBeNull();
          }
        }
      }
      state = result.state;
    }
  });

  it("is deterministic: the same seed and inputs reproduce the same game", () => {
    const original = randomPlayout("replay", 4);
    let { state } = createGame(
      { playerIds: IDS.slice(0, 4), ...DEFAULT_TIMEOUTS, actionTimeoutMs: 20_000 },
      "replay",
      0,
    );
    for (const { input, now } of original.inputs) {
      const result = applyInput(state, input, now);
      if (!result.ok) throw new Error(result.error);
      state = result.state;
    }
    expect(state).toEqual(original.final);
  });
});
