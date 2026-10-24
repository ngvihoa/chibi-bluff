import type { GameEvent } from "@chibi-bluff/engine";
import { describe, expect, it } from "vitest";
import { MOMENT_MS, momentPause } from "./local-host";
import { momentsFrom } from "./use-moments";

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

describe("momentPause", () => {
  it("holds bots long enough for every moment in the batch", () => {
    expect(momentPause(challenge)).toBe(MOMENT_MS.challenge + MOMENT_MS.eliminated);
    expect(momentPause([{ type: "PASSED", playerId: "you" }])).toBe(0);
  });
});
