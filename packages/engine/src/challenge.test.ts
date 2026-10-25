import { describe, expect, it } from "vitest";
import { getLegalInputs } from "./legal";
import type { Role } from "./rules";
import { getPlayer } from "./state";
import {
  challenge,
  coins,
  declare,
  eventTypes,
  hiddenCount,
  loseCard,
  pass,
  pick,
  play,
  reject,
  revealedRoles,
  setup,
  T0,
  TIMEOUT,
} from "./test-utils";

const hands = (an: Role[]) => ({
  hands: { an, binh: ["assassin", "contessa"], chi: ["ambassador", "duke"] } as Record<
    string,
    Role[]
  >,
});

describe("who may challenge", () => {
  it("R-CH-1: any other living player may challenge, not just the target", () => {
    const start = setup(hands(["captain", "duke"]));
    const { state } = play(start, declare("an", "steal", "binh"));
    expect(reject(state, challenge("an"))).toBe("CANNOT_CHALLENGE");
    const { events } = play(state, challenge("chi"));
    expect(events[0]).toEqual({
      type: "CHALLENGED",
      challengerId: "chi",
      claimantId: "an",
      role: "captain",
    });
  });

  it("R-CH-1: only the first challenge is processed", () => {
    const start = setup(hands(["captain", "duke"]));
    const { state } = play(start, [declare("an", "steal", "binh"), challenge("chi")]);
    // chi lost the challenge and must now pick a card; binh's late challenge is not accepted.
    expect(state.phase).toMatchObject({ kind: "AWAIT_INFLUENCE_LOSS", playerId: "chi" });
    expect(reject(state, challenge("binh"))).toBe("WRONG_PHASE");
  });

  it("general actions cannot be challenged", () => {
    const start = setup(hands(["captain", "duke"]));
    const { state } = play(start, declare("an", "foreignAid"));
    expect(reject(state, challenge("binh"))).toBe("CANNOT_CHALLENGE");
  });

  it("a player who already passed cannot challenge", () => {
    const start = setup(hands(["captain", "duke"]));
    const { state } = play(start, [declare("an", "tax"), pass("binh")]);
    expect(reject(state, challenge("binh"))).toBe("ALREADY_RESPONDED");
  });
});

describe("bluff caught", () => {
  it("R-CH-2 / R-CH-3: the bluffer loses a card and the action fails", () => {
    const start = setup(hands(["captain", "contessa"]));
    let { state, events } = play(start, [declare("an", "tax"), challenge("binh")]);
    expect(events).toContainEqual({
      type: "CHALLENGE_RESOLVED",
      challengerId: "binh",
      claimantId: "an",
      role: "duke",
      truthful: false,
    });
    expect(events).toContainEqual(
      expect.objectContaining({ type: "ACTION_FAILED", reason: "BLUFF_CAUGHT" }),
    );
    expect(state.phase).toMatchObject({
      kind: "AWAIT_INFLUENCE_LOSS",
      playerId: "an",
      reason: "BLUFF_CAUGHT",
    });
    ({ state } = play(state, loseCard("an", 0)));
    expect(coins(state, "an")).toBe(2);
    expect(revealedRoles(state, "an")).toEqual(["captain"]);
    expect(hiddenCount(state, "binh")).toBe(2);
    expect(state.turn.actorId).toBe("binh");
  });

  it("R-CH-3: the cost of a bluffed action is refunded", () => {
    const start = setup({ ...hands(["captain", "contessa"]), coins: { an: 3 } });
    const { state, events } = play(start, [declare("an", "assassinate", "binh"), challenge("chi")]);
    expect(coins(state, "an")).toBe(3);
    expect(events).toContainEqual({
      type: "COINS_CHANGED",
      playerId: "an",
      delta: 3,
      reason: "REFUND",
    });
    expect(hiddenCount(state, "binh")).toBe(2);
  });
});

describe("failed challenge", () => {
  it("R-CH-4: the challenger loses a card, the claimant swaps the proven card, the action happens", () => {
    const start = setup(hands(["duke", "captain"]));
    let { state } = play(start, [declare("an", "tax"), challenge("binh")]);
    expect(state.phase).toMatchObject({
      kind: "AWAIT_INFLUENCE_LOSS",
      playerId: "binh",
      reason: "FAILED_CHALLENGE",
    });
    ({ state } = play(state, loseCard("binh", 0)));
    // R-DG-8: an now picks a face-down card to replace the proven Duke.
    expect(state.phase).toMatchObject({ kind: "AWAIT_REPLACEMENT", playerId: "an", role: "duke" });
    const result = play(state, pick("an", 3));
    state = result.state;
    const replaced = result.events.find((e) => e.type === "CARD_REPLACED");
    expect(replaced).toMatchObject({ playerId: "an" });
    const anRoles = getPlayer(state, "an").cards.map((c) => c.role);
    expect(anRoles[1]).toBe("captain");
    expect(anRoles[0]).toBe(replaced?.type === "CARD_REPLACED" ? replaced.newRole : undefined);
    expect(coins(state, "an")).toBe(5);
    expect(state.turn.actorId).toBe("binh");
  });

  it("R-CH-5: the challenger loses before the claimant replaces the card", () => {
    // binh has one card left, so the loss is automatic.
    const start = setup({ ...hands(["duke", "captain"]), revealed: { binh: [0] } });
    const first = play(start, [declare("an", "tax"), challenge("binh")]);
    const types = eventTypes(first.events);
    expect(types.indexOf("INFLUENCE_LOST")).toBeLessThan(types.indexOf("CARD_RETURNED"));
    const after = play(first.state, pick("an"));
    expect(eventTypes(after.events).slice(0, 2)).toEqual(["CARD_REPLACED", "ACTION_RESOLVED"]);
  });

  it("R-CH-4: total cards stay at 3 per role through the replacement", () => {
    const start = setup(hands(["duke", "captain"]));
    const count = (state: typeof start) => {
      const all = [...state.deck, ...state.players.flatMap((p) => p.cards.map((c) => c.role))];
      return { total: all.length, dukes: all.filter((r) => r === "duke").length };
    };
    const mid = play(start, [declare("an", "tax"), challenge("binh"), loseCard("binh", 0)]).state;
    expect(count(mid)).toEqual({ total: 15, dukes: 3 });
    expect(count(play(mid, pick("an", 0)).state)).toEqual({ total: 15, dukes: 3 });
  });
});

describe("picking the replacement (R-DG-8)", () => {
  const ready = () =>
    play(setup(hands(["duke", "captain"])), [
      declare("an", "tax"),
      challenge("binh"),
      loseCard("binh", 0),
    ]);

  it("offers every face-down card: the deck plus the proven one, with a 15 s timer", () => {
    const { state, events } = ready();
    expect(state.phase).toMatchObject({
      kind: "AWAIT_REPLACEMENT",
      choices: state.deck.length + 1,
      deadline: T0 + 15_000,
    });
    expect(events).toContainEqual({ type: "CARD_RETURNED", playerId: "an", role: "duke" });
    expect(getLegalInputs(state, "an")).toHaveLength(state.deck.length + 1);
    expect(getLegalInputs(state, "binh")).toEqual([]);
  });

  it("can hand back the proven character itself", () => {
    const { state } = ready();
    const choices = state.phase.kind === "AWAIT_REPLACEMENT" ? state.phase.choices : 0;
    const drawn = new Set(
      Array.from(
        { length: choices },
        (_, i) => getPlayer(play(state, pick("an", i)).state, "an").cards[0]?.role,
      ),
    );
    expect(drawn.has("duke")).toBe(true);
    expect(drawn.size).toBeGreaterThan(1);
  });

  it("rejects other players and positions outside the deck", () => {
    const { state } = ready();
    expect(reject(state, pick("binh"))).toBe("NOT_YOUR_TURN");
    expect(reject(state, pick("an", -1))).toBe("INVALID_CARD");
    expect(reject(state, pick("an", 99))).toBe("INVALID_CARD");
    expect(reject(state, pick("an", 1.5))).toBe("INVALID_CARD");
    expect(reject(state, pass("an"))).toBe("WRONG_PHASE");
  });

  it("picks at random when time runs out", () => {
    const { state } = ready();
    expect(reject(state, TIMEOUT, T0 + 14_999)).toBe("DEADLINE_NOT_REACHED");
    const after = play(state, TIMEOUT, T0 + 15_000);
    expect(eventTypes(after.events)).toContain("CARD_REPLACED");
    expect(coins(after.state, "an")).toBe(5);
  });
});
