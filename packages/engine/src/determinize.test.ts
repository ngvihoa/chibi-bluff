import { describe, expect, it } from "vitest";
import { determinize, type WorldGuess } from "./determinize";
import { applyInput, createGame } from "./game";
import { getLegalInputs } from "./legal";
import { createRng, nextInt, type RngState, shuffle } from "./rng";
import type { Role } from "./rules";
import { DEFAULT_TIMEOUTS, type GameState, type PlayerId } from "./types";
import { getPlayerView } from "./view";

/** States met along random games (every legal input is fair game). */
function* states(seed: string, players: number): Generator<GameState> {
  const ids = Array.from({ length: players }, (_, i) => `p${i}`);
  let { state } = createGame({ playerIds: ids, ...DEFAULT_TIMEOUTS }, seed, 0);
  let rng = createRng(`${seed}:play`);
  for (let step = 0; step < 400 && state.phase.kind !== "GAME_OVER"; step++) {
    yield state;
    const inputs = ids.flatMap((id) => getLegalInputs(state, id));
    let pick: number;
    [pick, rng] = nextInt(rng, inputs.length);
    const result = applyInput(state, inputs[pick] as never, 0);
    if (!result.ok) throw new Error(result.error);
    state = result.state;
  }
}

/** The true hidden cards as `viewer` would guess them if it guessed right. */
function truth(state: GameState, viewer: PlayerId): WorldGuess {
  const hands = Object.fromEntries(
    state.players
      .filter((p) => p.id !== viewer)
      .map((p) => [p.id, p.cards.filter((c) => !c.revealed).map((c) => c.role)]),
  );
  const { phase } = state;
  const exchangeDrawn =
    phase.kind === "AWAIT_EXCHANGE" && phase.playerId !== viewer
      ? phase.options.slice(phase.keepCount)
      : undefined;
  return { hands, deck: [...state.deck], exchangeDrawn };
}

/** Another guess with the same counts: the viewer's unseen cards dealt out differently. */
function reshuffled(guess: WorldGuess, rng: RngState): WorldGuess {
  const pool: Role[] = [
    ...Object.values(guess.hands).flat(),
    ...guess.deck,
    ...(guess.exchangeDrawn ?? []),
  ];
  const [mixed] = shuffle(pool, rng);
  const take = (n: number) => mixed.splice(0, n);
  return {
    hands: Object.fromEntries(Object.entries(guess.hands).map(([id, h]) => [id, take(h.length)])),
    exchangeDrawn: guess.exchangeDrawn ? take(guess.exchangeDrawn.length) : undefined,
    deck: take(guess.deck.length),
  };
}

describe("determinize", () => {
  it("rebuilds the very state from a view and the true hidden cards", () => {
    for (const players of [2, 4, 6]) {
      for (const state of states(`truth-${players}`, players)) {
        for (const viewer of state.config.playerIds) {
          const world = determinize(getPlayerView(state, viewer), truth(state, viewer), "w");
          expect({ ...world, rng: null }).toEqual({ ...state, rng: null });
        }
      }
    }
  });

  it("any guess with the right counts keeps the viewer's view and options unchanged", () => {
    let rng = createRng("guesses");
    for (const players of [2, 3, 5]) {
      for (const state of states(`guess-${players}`, players)) {
        for (const viewer of state.config.playerIds) {
          const view = getPlayerView(state, viewer);
          rng = nextInt(rng, 2)[1];
          const world = determinize(view, reshuffled(truth(state, viewer), rng), "w");
          expect(getPlayerView(world, viewer)).toEqual(view);
          expect(getLegalInputs(world, viewer)).toEqual(getLegalInputs(state, viewer));
        }
      }
    }
  });

  it("refuses guesses that do not fit the view", () => {
    const [state] = states("refuse", 3);
    if (!state) throw new Error("no state");
    const view = getPlayerView(state, "p0");
    const guess = truth(state, "p0");
    expect(() => determinize(view, { ...guess, deck: guess.deck.slice(1) }, "w")).toThrow();
    const tooMany = structuredClone(guess);
    (tooMany.hands.p1 as Role[]).push("duke");
    expect(() => determinize(view, tooMany, "w")).toThrow();
    const fourDukes = structuredClone(guess);
    fourDukes.hands.p1 = ["duke", "duke"];
    fourDukes.hands.p2 = ["duke", "duke"];
    expect(() => determinize(view, fourDukes, "w")).toThrow();
  });
});
