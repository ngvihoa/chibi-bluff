import type { GameEvent } from "@chibi-bluff/engine";
import { describe, expect, it } from "vitest";
import { legsFrom } from "./fly-layer";

describe("legsFrom", () => {
  it("moves two cards each way for an exchange and one each way for a won challenge", () => {
    const events: GameEvent[] = [
      { type: "EXCHANGE_STARTED", playerId: "a", drawn: null },
      { type: "EXCHANGE_COMPLETED", playerId: "a" },
      { type: "CARD_RETURNED", playerId: "b", role: "duke" },
      { type: "CARD_REPLACED", playerId: "b", newRole: null },
      { type: "PASSED", playerId: "c" },
    ];
    expect(legsFrom(events)).toEqual([
      { playerId: "a", toDeck: false, count: 2 },
      { playerId: "a", toDeck: true, count: 2 },
      { playerId: "b", toDeck: true, count: 1 },
      { playerId: "b", toDeck: false, count: 1 },
    ]);
  });
});
