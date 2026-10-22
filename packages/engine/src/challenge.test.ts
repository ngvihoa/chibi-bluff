import { describe, expect, it } from "vitest";
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
  play,
  reject,
  revealedRoles,
  setup,
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
    const start = setup({ ...hands(["duke", "captain"]), deckTop: ["contessa"] });
    let { state } = play(start, [declare("an", "tax"), challenge("binh")]);
    expect(state.phase).toMatchObject({
      kind: "AWAIT_INFLUENCE_LOSS",
      playerId: "binh",
      reason: "FAILED_CHALLENGE",
    });
    const result = play(state, loseCard("binh", 0));
    state = result.state;
    const replaced = result.events.find((e) => e.type === "CARD_REPLACED");
    expect(replaced).toMatchObject({ playerId: "an" });
    // The proven Duke went back into the deck; an drew a card in its place.
    const anRoles = getPlayer(state, "an").cards.map((c) => c.role);
    expect(anRoles[1]).toBe("captain");
    expect(anRoles[0]).toBe(replaced?.type === "CARD_REPLACED" ? replaced.newRole : undefined);
    expect(coins(state, "an")).toBe(5);
    expect(state.turn.actorId).toBe("binh");
  });

  it("R-CH-5: the challenger loses before the claimant replaces the card", () => {
    // binh has one card left, so the loss is automatic and everything happens in one input.
    const start = setup({ ...hands(["duke", "captain"]), revealed: { binh: [0] } });
    const { events } = play(start, [declare("an", "tax"), challenge("binh")]);
    const types = eventTypes(events);
    expect(types.indexOf("INFLUENCE_LOST")).toBeLessThan(types.indexOf("CARD_REPLACED"));
    expect(types.indexOf("CARD_REPLACED")).toBeLessThan(types.indexOf("ACTION_RESOLVED"));
  });

  it("R-CH-4: total cards stay at 3 per role after a replacement", () => {
    const start = setup(hands(["duke", "captain"]));
    const { state } = play(start, [declare("an", "tax"), challenge("binh"), loseCard("binh", 0)]);
    const all = [...state.deck, ...state.players.flatMap((p) => p.cards.map((c) => c.role))];
    expect(all.filter((r) => r === "duke")).toHaveLength(3);
    expect(all).toHaveLength(15);
  });
});
