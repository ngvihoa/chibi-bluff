import { describe, expect, it } from "vitest";
import { createGame } from "./game";
import { createDeck } from "./rules";
import { DEFAULT_TIMEOUTS, type GameConfig } from "./types";

const IDS = ["an", "binh", "chi", "dung", "giang", "hoa"];
const config = (n: number): GameConfig => ({ playerIds: IDS.slice(0, n), ...DEFAULT_TIMEOUTS });

describe("setup", () => {
  it.each([2, 3, 4, 5, 6])("R-SU-1: deals 2 face-down cards to each of %i players", (n) => {
    const { state } = createGame(config(n), "deal", 0);
    for (const player of state.players) {
      expect(player.cards).toHaveLength(2);
      expect(player.cards.every((c) => !c.revealed)).toBe(true);
    }
    expect(state.deck).toHaveLength(15 - 2 * n);
    const all = [...state.deck, ...state.players.flatMap((p) => p.cards.map((c) => c.role))];
    expect(all.sort()).toEqual(createDeck().sort());
  });

  it("R-SU-2: everyone starts with 2 coins", () => {
    const { state } = createGame(config(4), "coins", 0);
    expect(state.players.map((p) => p.coins)).toEqual([2, 2, 2, 2]);
  });

  it("R-SU-3: the first player is random but fixed by the seed", () => {
    const firstOf = (seed: string) => createGame(config(6), seed, 0).state.turn.actorId;
    expect(firstOf("same")).toBe(firstOf("same"));
    const firsts = new Set(Array.from({ length: 60 }, (_, i) => firstOf(`seed-${i}`)));
    expect(firsts.size).toBeGreaterThan(3);
  });

  it("R-SU-4: in a 2-player game the first player starts with 1 coin", () => {
    for (let i = 0; i < 10; i++) {
      const { state } = createGame(config(2), `two-${i}`, 0);
      const first = state.turn.actorId;
      for (const p of state.players) expect(p.coins).toBe(p.id === first ? 1 : 2);
    }
  });

  it("starts in AWAIT_ACTION and announces the first turn", () => {
    const { state, events } = createGame(config(3), "start", 0);
    expect(state.phase).toEqual({ kind: "AWAIT_ACTION", deadline: null });
    expect(state.turnNumber).toBe(1);
    expect(events).toEqual([
      { type: "GAME_STARTED", firstPlayerId: state.turn.actorId },
      { type: "TURN_STARTED", playerId: state.turn.actorId, turnNumber: 1 },
    ]);
  });

  it("rejects invalid configs", () => {
    expect(() => createGame(config(1), "x", 0)).toThrow();
    expect(() => createGame({ ...config(6), playerIds: [...IDS, "khoa"] }, "x", 0)).toThrow();
    expect(() => createGame({ ...config(2), playerIds: ["an", "an"] }, "x", 0)).toThrow();
    expect(() => createGame({ ...config(2), responseTimeoutMs: 0 }, "x", 0)).toThrow();
  });
});
