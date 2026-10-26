import type { GameEvent } from "@chibi-bluff/engine";
import { describe, expect, it } from "vitest";
import { MOMENT_MS, momentPause } from "./local-host";
import { momentsFrom, recapFrom } from "./use-moments";

const challenge: GameEvent[] = [
  { type: "CHALLENGED", challengerId: "you", claimantId: "bot-1", role: "duke" },
  {
    type: "CHALLENGE_RESOLVED",
    challengerId: "you",
    claimantId: "bot-1",
    role: "duke",
    truthful: false,
  },
  { type: "COINS_CHANGED", playerId: "bot-1", delta: 3, reason: "REFUND" },
  { type: "INFLUENCE_LOST", playerId: "bot-1", role: "captain", reason: "BLUFF_CAUGHT" },
  { type: "COINS_CHANGED", playerId: "bot-1", delta: -3, reason: "ELIMINATED" },
  { type: "PLAYER_ELIMINATED", playerId: "bot-1" },
];

describe("momentsFrom", () => {
  it("queues the challenge verdict, then the elimination", () => {
    let id = 0;
    const { moments } = momentsFrom(challenge, () => ++id);
    expect(moments).toEqual([
      {
        id: 1,
        kind: "challenge",
        challengerId: "you",
        claimantId: "bot-1",
        role: "duke",
        truthful: false,
      },
      { id: 3, kind: "eliminated", playerId: "bot-1" },
    ]);
  });

  it("floats coin changes but not coins returned on elimination", () => {
    let id = 0;
    const { floats } = momentsFrom(challenge, () => ++id);
    expect(floats).toEqual([{ id: 2, playerId: "bot-1", delta: 3 }]);
  });

  it("produces nothing for quiet events", () => {
    const { moments, floats } = momentsFrom([{ type: "PASSED", playerId: "you" }], () => 1);
    expect(moments).toEqual([]);
    expect(floats).toEqual([]);
  });
});

const income: GameEvent[] = [
  { type: "ACTION_DECLARED", action: { type: "income", actorId: "bot-1", targetId: null } },
  { type: "ACTION_RESOLVED", action: { type: "income", actorId: "bot-1", targetId: null } },
  { type: "COINS_CHANGED", playerId: "bot-1", delta: 1, reason: "INCOME" },
  { type: "TURN_STARTED", playerId: "you", turnNumber: 2 },
];

describe("momentPause", () => {
  it("holds bots long enough for every moment in the batch", () => {
    expect(momentPause(challenge)).toBe(MOMENT_MS.challenge + MOMENT_MS.eliminated);
    expect(momentPause([{ type: "PASSED", playerId: "you" }])).toBe(0);
  });

  it("pauses after every turn and after a block", () => {
    expect(momentPause(income)).toBe(MOMENT_MS.turn);
    expect(
      momentPause([{ type: "BLOCK_DECLARED", block: { blockerId: "you", role: "duke" } }]),
    ).toBe(MOMENT_MS.block);
  });
});

describe("recapFrom", () => {
  it("summarises a turn that just ended", () => {
    expect(recapFrom(income, 7)).toEqual({ id: 7, events: income.slice(0, 3) });
  });

  it("is empty mid-turn, at game start and at game over", () => {
    expect(recapFrom(challenge, 1)).toBeNull();
    expect(
      recapFrom([{ type: "GAME_STARTED", firstPlayerId: "you" }, ...income.slice(3)], 1),
    ).toBeNull();
    expect(recapFrom([...income, { type: "GAME_OVER", winnerId: "you" }], 1)).toBeNull();
  });
});

describe("replacement draw (R-DG-8)", () => {
  const drew: GameEvent[] = [{ type: "CARD_REPLACED", playerId: "you", newRole: "captain" }];
  const hidden: GameEvent[] = [{ type: "CARD_REPLACED", playerId: "bot-1", newRole: null }];

  it("leaves the reveal to the full-screen pick, not a moment overlay", () => {
    expect(momentsFrom(drew, () => 1).moments).toEqual([]);
  });

  it("pauses bots while you peek at your new card, not when someone else draws", () => {
    expect(momentPause(drew, "you")).toBe(MOMENT_MS.drew);
    expect(momentPause(hidden, "you")).toBe(0);
  });
});
