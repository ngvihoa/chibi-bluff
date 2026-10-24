import { describe, expect, it } from "vitest";
import type { Role } from "./rules";
import { getPlayer } from "./state";
import {
  coins,
  declare,
  eventTypes,
  hiddenCount,
  keep,
  loseCard,
  pass,
  play,
  reject,
  setup,
} from "./test-utils";

// an acts first; binh and chi respond.
const baseOptions = () => ({
  hands: {
    an: ["duke", "captain"],
    binh: ["assassin", "contessa"],
    chi: ["ambassador", "duke"],
  } as Record<string, Role[]>,
});
const base = () => setup(baseOptions());

describe("general actions", () => {
  it("R-AC-1: Income gives +1 immediately and passes the turn clockwise", () => {
    const { state, events } = play(base(), declare("an", "income"));
    expect(coins(state, "an")).toBe(3);
    expect(state.turn.actorId).toBe("binh");
    expect(state.turnNumber).toBe(2);
    expect(eventTypes(events)).toEqual([
      "ACTION_DECLARED",
      "ACTION_RESOLVED",
      "COINS_CHANGED",
      "TURN_STARTED",
    ]);
  });

  it("R-AC-2: Foreign Aid gives +2 once everyone passes", () => {
    let { state } = play(base(), declare("an", "foreignAid"));
    expect(state.phase.kind).toBe("AWAIT_ACTION_RESPONSE");
    ({ state } = play(state, [pass("binh"), pass("chi")]));
    expect(coins(state, "an")).toBe(4);
    expect(state.turn.actorId).toBe("binh");
  });

  it("R-AC-3: Coup costs 7, skips the response window and costs the target a card", () => {
    const start = setup({ ...baseOptions(), coins: { an: 7 } });
    let { state } = play(start, declare("an", "coup", "binh"));
    expect(coins(state, "an")).toBe(0);
    expect(state.phase).toMatchObject({
      kind: "AWAIT_INFLUENCE_LOSS",
      playerId: "binh",
      reason: "COUP",
    });
    ({ state } = play(state, loseCard("binh", 1)));
    expect(getPlayer(state, "binh").cards[1]?.revealed).toBe(true);
    expect(state.turn.actorId).toBe("binh");
  });
});

describe("character actions", () => {
  it("R-AC-4: Tax gives +3 once nobody challenges", () => {
    const { state } = play(base(), [declare("an", "tax"), pass("binh"), pass("chi")]);
    expect(coins(state, "an")).toBe(5);
  });

  it("R-AC-5 / R-AC-11: Assassinate is paid on declaration and costs the target a card", () => {
    const start = setup({ ...baseOptions(), first: "binh", coins: { binh: 3 } });
    let { state } = play(start, declare("binh", "assassinate", "chi"));
    expect(coins(state, "binh")).toBe(0);
    expect(state.phase.kind).toBe("AWAIT_ACTION_RESPONSE");
    ({ state } = play(state, [pass("an"), pass("chi")]));
    expect(state.phase).toMatchObject({
      kind: "AWAIT_INFLUENCE_LOSS",
      playerId: "chi",
      reason: "ASSASSINATED",
    });
  });

  it.each([
    [5, 2],
    [1, 1],
    [0, 0],
  ])("R-AC-6: Steal from a target with %i coins takes %i", (targetCoins, taken) => {
    const start = setup({ ...baseOptions(), coins: { an: 2, binh: targetCoins } });
    const { state } = play(start, [declare("an", "steal", "binh"), pass("binh"), pass("chi")]);
    expect(coins(state, "an")).toBe(2 + taken);
    expect(coins(state, "binh")).toBe(targetCoins - taken);
  });

  it("R-AC-7: Exchange draws 2, keeps as many as were face down, returns the rest", () => {
    const start = setup({
      hands: { an: ["ambassador", "captain"], binh: ["duke", "duke"], chi: ["duke", "contessa"] },
      deckTop: ["assassin", "contessa"],
    });
    let { state, events } = play(start, [declare("an", "exchange"), pass("binh"), pass("chi")]);
    expect(state.phase).toMatchObject({
      kind: "AWAIT_EXCHANGE",
      playerId: "an",
      options: ["ambassador", "captain", "assassin", "contessa"],
      keepCount: 2,
    });
    expect(events).toContainEqual({
      type: "EXCHANGE_STARTED",
      playerId: "an",
      drawn: ["assassin", "contessa"],
    });
    expect(state.deck).toHaveLength(7);

    ({ state, events } = play(state, keep("an", [2, 3])));
    expect(getPlayer(state, "an").cards.map((c) => c.role)).toEqual(["assassin", "contessa"]);
    expect(state.deck).toHaveLength(9);
    expect(state.deck.filter((r) => r === "ambassador")).toHaveLength(3);
    expect(eventTypes(events)).toContain("EXCHANGE_COMPLETED");
    expect(state.turn.actorId).toBe("binh");
  });

  it("R-AC-7: with one face-down card, Exchange keeps exactly one", () => {
    const start = setup({
      hands: { an: ["ambassador", "captain"], binh: ["duke", "duke"], chi: ["duke", "contessa"] },
      revealed: { an: [1] },
      deckTop: ["assassin", "contessa"],
    });
    let { state } = play(start, [declare("an", "exchange"), pass("binh"), pass("chi")]);
    expect(state.phase).toMatchObject({ kind: "AWAIT_EXCHANGE", keepCount: 1 });
    expect(reject(state, keep("an", [0, 1]))).toBe("INVALID_EXCHANGE");
    ({ state } = play(state, keep("an", [2])));
    expect(getPlayer(state, "an").cards).toEqual([
      { role: "contessa", revealed: false },
      { role: "captain", revealed: true },
    ]);
  });

  it("R-AC-7: rejects malformed exchange choices", () => {
    const start = setup({
      hands: { an: ["ambassador", "captain"], binh: ["duke", "duke"], chi: ["duke", "contessa"] },
    });
    const { state } = play(start, [declare("an", "exchange"), pass("binh"), pass("chi")]);
    expect(reject(state, keep("an", [0, 0]))).toBe("INVALID_EXCHANGE");
    expect(reject(state, keep("an", [0, 4]))).toBe("INVALID_EXCHANGE");
    expect(reject(state, keep("an", [1.5, 2]))).toBe("INVALID_EXCHANGE");
    expect(reject(state, keep("binh", [0, 1]))).toBe("NOT_YOUR_TURN");
  });
});

describe("constraints", () => {
  it("R-AC-8: with 10+ coins the only legal action is Coup", () => {
    const start = setup({ ...baseOptions(), coins: { an: 10 } });
    expect(reject(start, declare("an", "income"))).toBe("MUST_COUP");
    expect(reject(start, declare("an", "tax"))).toBe("MUST_COUP");
    const { state } = play(start, declare("an", "coup", "chi"));
    expect(coins(state, "an")).toBe(3);
  });

  it("R-AC-9: cannot afford Coup or Assassinate without enough coins", () => {
    const start = setup({ ...baseOptions(), coins: { an: 6 } });
    expect(reject(start, declare("an", "coup", "binh"))).toBe("NOT_ENOUGH_COINS");
    const poor = setup({ ...baseOptions(), coins: { an: 2 } });
    expect(reject(poor, declare("an", "assassinate", "binh"))).toBe("NOT_ENOUGH_COINS");
  });

  it("R-AC-10: targets must be other players still in the game", () => {
    const start = setup({ ...baseOptions(), revealed: { chi: [0, 1] } });
    expect(reject(start, declare("an", "steal", "an"))).toBe("INVALID_TARGET");
    expect(reject(start, declare("an", "steal", "chi"))).toBe("INVALID_TARGET");
    expect(reject(start, declare("an", "steal", "nobody"))).toBe("INVALID_TARGET");
    expect(reject(start, declare("an", "steal"))).toBe("INVALID_TARGET");
    expect(reject(start, declare("an", "tax", "binh"))).toBe("INVALID_TARGET");
  });

  it("only the current player may declare, and only during AWAIT_ACTION", () => {
    const start = base();
    expect(reject(start, declare("binh", "income"))).toBe("NOT_YOUR_TURN");
    expect(reject(start, pass("an"))).toBe("WRONG_PHASE");
    expect(reject(start, declare("ghost", "income"))).toBe("UNKNOWN_PLAYER");
    expect(reject(start, { type: "DECLARE", playerId: "an", action: "nap" as "tax" })).toBe(
      "INVALID_ACTION",
    );
  });

  it("turn order skips eliminated players", () => {
    const start = setup({ ...baseOptions(), revealed: { binh: [0, 1] } });
    const { state } = play(start, declare("an", "income"));
    expect(state.turn.actorId).toBe("chi");
    expect(hiddenCount(state, "binh")).toBe(0);
  });
});
