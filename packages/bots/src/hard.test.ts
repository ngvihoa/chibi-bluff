import {
  applyInput,
  createDeck,
  createGame,
  createRng,
  DEFAULT_TIMEOUTS,
  determinize,
  type GameState,
  getLegalInputs,
  getPlayerView,
  type PlayerId,
  type PlayerInput,
  type Role,
} from "@chibi-bluff/engine";
import { describe, expect, it } from "vitest";
import { createHardBot } from "./hard";
import { guessWorld, unseenPool } from "./hard/guess";
import { createMemory, observe } from "./memory";
import { normalBot } from "./normal";
import { PERSONALITIES } from "./personality";
import { simulateGame } from "./sim/simulate";
import type { BotMemory } from "./types";

/** A game at the start of `first`'s turn with exactly these hands (and the rest in the deck). */
function craft(
  hands: Record<PlayerId, Role[]>,
  {
    coins = {},
    revealed = {},
    first,
  }: {
    coins?: Record<PlayerId, number>;
    revealed?: Record<PlayerId, number[]>;
    first?: PlayerId;
  } = {},
): GameState {
  const ids = Object.keys(hands);
  const { state } = createGame({ playerIds: ids, ...DEFAULT_TIMEOUTS }, "craft", 0);
  const deck = createDeck();
  for (const p of state.players) {
    p.cards = (hands[p.id] as Role[]).map((role, i) => {
      deck.splice(deck.indexOf(role), 1);
      return { role, revealed: revealed[p.id]?.includes(i) ?? false };
    });
    p.coins = coins[p.id] ?? 2;
  }
  state.deck = deck;
  state.turn = { actorId: first ?? (ids[0] as PlayerId), action: null, block: null };
  return state;
}

function play(state: GameState, ...inputs: PlayerInput[]): GameState {
  let s = state;
  for (const input of inputs) {
    const r = applyInput(s, input, 0);
    if (!r.ok) throw new Error(r.error);
    s = r.state;
  }
  return s;
}

const fast = (algorithm: "ismcts" | "pimc" = "pimc", maxIterations = 300) =>
  createHardBot({ algorithm, maxIterations, timeMs: 60_000 });

function decide(state: GameState, id: PlayerId, memory?: BotMemory, bot = fast()) {
  return bot.decide({
    view: getPlayerView(state, id),
    legal: getLegalInputs(state, id),
    memory: memory ?? createMemory(id, state.config.playerIds),
    personality: PERSONALITIES.balanced,
    rng: createRng(`decide-${id}`),
  });
}

describe("guessing the hidden cards", () => {
  it("always fits the view: three of each character, the right card counts", () => {
    let checked = 0;
    for (let g = 0; g < 4; g++) {
      simulateGame(
        Array.from({ length: 2 + g }, (_, i) => ({
          label: `s${i}`,
          policy: normalBot,
          personality: PERSONALITIES.balanced,
        })),
        `guess-${g}`,
        (state) => {
          for (const id of state.config.playerIds) {
            const view = getPlayerView(state, id);
            const [guess] = guessWorld(
              view,
              createMemory(id, state.config.playerIds),
              createRng(`${g}-${checked}`),
            );
            // determinize throws when a guess does not fit the view.
            const world = determinize(view, guess, "w");
            expect(getPlayerView(world, id)).toEqual(view);
            checked += 1;
          }
        },
      );
    }
    expect(checked).toBeGreaterThan(100);
  });

  it("a character just proven stays in its owner's hand until it is replaced", () => {
    // Binh claims Duke, An challenges and loses: Binh still holds the proven Duke.
    let state = craft(
      { an: ["captain", "contessa"], binh: ["duke", "assassin"] },
      { first: "binh" },
    );
    state = play(
      state,
      { type: "DECLARE", playerId: "binh", action: "tax" },
      { type: "CHALLENGE", playerId: "an" },
    );
    const view = getPlayerView(state, "an");
    expect(unseenPool(view).duke).toBeGreaterThan(0);
    for (let i = 0; i < 20; i++) {
      const [guess] = guessWorld(
        view,
        createMemory("an", ["an", "binh"]),
        createRng(`proven-${i}`),
      );
      expect(guess.hands.binh).toContain("duke");
    }
  });

  it("keeps a proven card for its owner even when the other copies are nearly gone", () => {
    // Binh proves Duke against Cuong. An is believed to hold Dukes, so guesses lean towards giving
    // An the other copies; Binh's proven Duke must still always be there.
    let state = craft(
      { an: ["captain", "contessa"], binh: ["duke", "assassin"], cuong: ["ambassador", "captain"] },
      { first: "binh" },
    );
    state = play(
      state,
      { type: "DECLARE", playerId: "binh", action: "tax" },
      { type: "CHALLENGE", playerId: "cuong" },
    );
    const view = getPlayerView(state, "cuong");
    let memory = createMemory("cuong", ["an", "binh", "cuong"]);
    for (let t = 0; t < 4; t++) {
      memory = observe(memory, [
        { type: "ACTION_DECLARED", action: { type: "tax", actorId: "an", targetId: null } },
        { type: "ACTION_RESOLVED", action: { type: "tax", actorId: "an", targetId: null } },
      ]);
    }
    let rng = createRng("scarce");
    for (let i = 0; i < 200; i++) {
      let guess: ReturnType<typeof guessWorld>[0];
      [guess, rng] = guessWorld(view, memory, rng);
      expect(guess.hands.binh).toContain("duke");
      expect(() => determinize(view, guess, "w")).not.toThrow();
    }
  });

  it("someone who keeps claiming a character is guessed to hold it more often", () => {
    const state = craft({
      me: ["captain", "contessa"],
      an: ["duke", "assassin"],
      binh: ["ambassador", "captain"],
    });
    const view = getPlayerView(state, "me");
    let memory = createMemory("me", ["me", "an", "binh"]);
    for (let turn = 1; turn <= 3; turn++) {
      memory = observe(memory, [
        { type: "TURN_STARTED", playerId: "an", turnNumber: turn },
        { type: "ACTION_DECLARED", action: { type: "tax", actorId: "an", targetId: null } },
        { type: "ACTION_RESOLVED", action: { type: "tax", actorId: "an", targetId: null } },
        { type: "TURN_STARTED", playerId: "binh", turnNumber: turn + 1 },
      ]);
    }
    const plain = createMemory("me", ["me", "an", "binh"]);
    const dukeShare = (m: BotMemory) => {
      let rng = createRng("share");
      let hits = 0;
      for (let i = 0; i < 400; i++) {
        let guess: ReturnType<typeof guessWorld>[0];
        [guess, rng] = guessWorld(view, m, rng);
        if (guess.hands.an?.includes("duke")) hits += 1;
      }
      return hits / 400;
    };
    expect(dukeShare(memory)).toBeGreaterThan(dukeShare(plain) + 0.2);
  });
});

describe("hard bot", () => {
  it("only ever answers with a legal input", () => {
    for (const algorithm of ["ismcts", "pimc"] as const) {
      simulateGame(
        [
          { label: "hard", policy: fast(algorithm, 40), personality: PERSONALITIES.balanced },
          { label: "normal", policy: normalBot, personality: PERSONALITIES.balanced },
          { label: "normal2", policy: normalBot, personality: PERSONALITIES.balanced },
        ],
        `legal-${algorithm}`,
        (state, seat, decision) => {
          if (seat.label !== "hard") return;
          const legal = getLegalInputs(state, decision.input.playerId);
          expect(legal).toContainEqual(decision.input);
        },
      );
    }
  });

  it("answers a lone move at once, without thinking", () => {
    let clockCalls = 0;
    const bot = createHardBot({ now: () => clockCalls++ });
    // Must coup at 10 coins, against the only opponent: one legal input.
    const state = craft(
      { me: ["duke", "captain"], an: ["contessa", "assassin"] },
      { coins: { me: 10 } },
    );
    const decision = decide(state, "me", undefined, bot);
    expect(decision.input).toMatchObject({ type: "DECLARE", action: "coup", targetId: "an" });
    expect(clockCalls).toBe(0);
  });

  it("stops thinking when its time is up", () => {
    let t = 0;
    const bot = createHardBot({ timeMs: 100, now: () => (t += 10) });
    const state = craft({
      me: ["duke", "captain"],
      an: ["contessa", "assassin"],
      binh: ["ambassador", "duke"],
    });
    decide(state, "me", undefined, bot);
    // Roughly ten clock reads at 10 ms each fit in 100 ms.
    expect(t).toBeLessThan(400);
  });

  it("finishes the game with a coup when it can", () => {
    const state = craft(
      { me: ["duke", "captain"], an: ["contessa", "assassin"] },
      { coins: { me: 7 }, revealed: { an: [0] } },
    );
    for (const algorithm of ["ismcts", "pimc"] as const) {
      expect(decide(state, "me", undefined, fast(algorithm)).input).toMatchObject({
        type: "DECLARE",
        action: "coup",
      });
    }
  });

  it("challenges a claim that card counting proves to be a bluff", () => {
    // Two Dukes are face up and I hold the third: An's Tax is a sure bluff, and An is on one card.
    let state = craft(
      { me: ["duke", "captain"], an: ["duke", "assassin"], binh: ["duke", "contessa"] },
      { revealed: { an: [0], binh: [0] }, first: "an" },
    );
    state = play(state, { type: "DECLARE", playerId: "an", action: "tax" });
    for (const algorithm of ["ismcts", "pimc"] as const) {
      expect(decide(state, "me", undefined, fast(algorithm)).input.type).toBe("CHALLENGE");
    }
  });
});
