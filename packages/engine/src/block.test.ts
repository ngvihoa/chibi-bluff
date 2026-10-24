import { describe, expect, it } from "vitest";
import type { Role } from "./rules";
import {
  block,
  challenge,
  coins,
  declare,
  eventTypes,
  hiddenCount,
  loseCard,
  pass,
  play,
  reject,
  setup,
} from "./test-utils";

const game = (hands: Record<string, Role[]>, extra: Partial<Parameters<typeof setup>[0]> = {}) =>
  setup({ hands, ...extra });

describe("who may block", () => {
  it("R-BL-1: anyone may block Foreign Aid by claiming Duke", () => {
    const start = game({
      an: ["captain", "captain"],
      binh: ["assassin", "assassin"],
      chi: ["contessa", "contessa"],
    });
    const { state } = play(start, [declare("an", "foreignAid"), block("chi", "duke")]);
    expect(state.phase.kind).toBe("AWAIT_BLOCK_RESPONSE");
    expect(state.turn.block).toEqual({ blockerId: "chi", role: "duke" });
  });

  it("R-BL-1: only the target may block Assassinate, and only with Contessa", () => {
    const start = game(
      { an: ["assassin", "duke"], binh: ["contessa", "duke"], chi: ["contessa", "captain"] },
      { coins: { an: 3 } },
    );
    const { state } = play(start, declare("an", "assassinate", "binh"));
    expect(reject(state, block("chi", "contessa"))).toBe("CANNOT_BLOCK");
    expect(reject(state, block("binh", "duke"))).toBe("CANNOT_BLOCK");
    expect(play(state, block("binh", "contessa")).state.phase.kind).toBe("AWAIT_BLOCK_RESPONSE");
  });

  it("R-BL-1: only the target may block Steal, with Captain or Ambassador", () => {
    const start = game({
      an: ["captain", "duke"],
      binh: ["duke", "duke"],
      chi: ["captain", "ambassador"],
    });
    const { state } = play(start, declare("an", "steal", "binh"));
    expect(reject(state, block("chi", "captain"))).toBe("CANNOT_BLOCK");
    expect(reject(state, block("binh", "contessa"))).toBe("CANNOT_BLOCK");
    expect(play(state, block("binh", "captain")).state.turn.block?.role).toBe("captain");
    expect(play(state, block("binh", "ambassador")).state.turn.block?.role).toBe("ambassador");
  });

  it("R-BL-1: unblockable actions cannot be blocked", () => {
    const start = game({
      an: ["duke", "duke"],
      binh: ["contessa", "captain"],
      chi: ["contessa", "captain"],
    });
    const { state } = play(start, declare("an", "tax"));
    expect(reject(state, block("binh", "duke"))).toBe("CANNOT_BLOCK");
  });
});

describe("resolving blocks", () => {
  it("R-BL-2: anyone, including the actor, may challenge a block", () => {
    const start = game({
      an: ["captain", "duke"],
      binh: ["ambassador", "duke"],
      chi: ["contessa", "contessa"],
    });
    const { state } = play(start, [declare("an", "steal", "binh"), block("binh", "ambassador")]);
    expect(reject(state, challenge("binh"))).toBe("CANNOT_CHALLENGE");
    expect(play(state, challenge("an")).events[0]).toMatchObject({ challengerId: "an" });
    expect(play(state, challenge("chi")).events[0]).toMatchObject({ challengerId: "chi" });
  });

  it("R-BL-3: a block cannot be blocked", () => {
    const start = game({
      an: ["captain", "duke"],
      binh: ["ambassador", "duke"],
      chi: ["captain", "contessa"],
    });
    const { state } = play(start, [declare("an", "steal", "binh"), block("binh", "ambassador")]);
    expect(reject(state, block("an", "captain"))).toBe("WRONG_PHASE");
  });

  it("R-BL-4: an unchallenged block stops the action and the cost is not refunded", () => {
    const start = game(
      { an: ["assassin", "duke"], binh: ["contessa", "duke"], chi: ["captain", "captain"] },
      { coins: { an: 3 } },
    );
    const { state, events } = play(start, [
      declare("an", "assassinate", "binh"),
      block("binh", "contessa"),
      pass("an"),
      pass("chi"),
    ]);
    expect(eventTypes(events)).toContain("ACTION_BLOCKED");
    expect(eventTypes(events)).not.toContain("ACTION_RESOLVED");
    expect(coins(state, "an")).toBe(0);
    expect(hiddenCount(state, "binh")).toBe(2);
    expect(state.turn.actorId).toBe("binh");
  });

  it("R-BL-4: a truthful block survives a challenge; the challenger loses a card", () => {
    const start = game({
      an: ["captain", "duke"],
      binh: ["ambassador", "duke"],
      chi: ["contessa", "contessa"],
    });
    let { state, events } = play(start, [
      declare("an", "steal", "binh"),
      block("binh", "ambassador"),
      challenge("an"),
    ]);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "CHALLENGE_RESOLVED", truthful: true }),
    );
    ({ state, events } = play(state, loseCard("an", 1)));
    expect(eventTypes(events)).toEqual(
      expect.arrayContaining(["INFLUENCE_LOST", "CARD_REPLACED", "ACTION_BLOCKED", "TURN_STARTED"]),
    );
    expect(coins(state, "an")).toBe(2);
    expect(coins(state, "binh")).toBe(2);
  });

  it("R-BL-5: a bluffed block that is caught costs the blocker a card and the action happens", () => {
    const start = game({
      an: ["captain", "duke"],
      binh: ["duke", "contessa"],
      chi: ["contessa", "assassin"],
    });
    let { state } = play(start, [
      declare("an", "steal", "binh"),
      block("binh", "captain"),
      challenge("an"),
    ]);
    expect(state.phase).toMatchObject({
      kind: "AWAIT_INFLUENCE_LOSS",
      playerId: "binh",
      reason: "BLUFF_CAUGHT",
    });
    ({ state } = play(state, loseCard("binh", 0)));
    expect(coins(state, "an")).toBe(4);
    expect(coins(state, "binh")).toBe(0);
  });
});

describe("block after a failed challenge", () => {
  it("the target may still block once a challenge on the action fails", () => {
    const start = game({
      an: ["captain", "duke"],
      binh: ["ambassador", "duke"],
      chi: ["contessa", "assassin"],
    });
    let { state } = play(start, [
      declare("an", "steal", "binh"),
      challenge("binh"),
      loseCard("binh", 1),
    ]);
    expect(state.phase).toMatchObject({ kind: "AWAIT_ACTION_RESPONSE", allowChallenge: false });
    expect(reject(state, pass("chi"))).toBe("NOT_ELIGIBLE");
    expect(reject(state, challenge("binh"))).toBe("CANNOT_CHALLENGE");
    ({ state } = play(state, [block("binh", "ambassador"), pass("an"), pass("chi")]));
    expect(coins(state, "an")).toBe(2);
    expect(coins(state, "binh")).toBe(2);
  });

  it("if the target passes the reopened window, the action goes ahead", () => {
    const start = game({
      an: ["captain", "duke"],
      binh: ["ambassador", "duke"],
      chi: ["contessa", "assassin"],
    });
    const { state } = play(start, [
      declare("an", "steal", "binh"),
      challenge("binh"),
      loseCard("binh", 1),
      pass("binh"),
    ]);
    expect(coins(state, "an")).toBe(4);
  });
});
