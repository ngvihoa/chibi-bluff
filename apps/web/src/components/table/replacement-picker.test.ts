import type { GameEvent } from "@chibi-bluff/engine";
import { describe, expect, it } from "vitest";
import { drawnRole, gridColumns } from "./replacement-picker";

describe("replacement picker", () => {
  it("finds the card you drew, never someone else's", () => {
    const events: GameEvent[] = [
      { type: "CARD_REPLACED", playerId: "bot-1", newRole: null },
      { type: "CARD_REPLACED", playerId: "you", newRole: "captain" },
    ];
    expect(drawnRole(events, "you")).toBe("captain");
    expect(drawnRole(events, "bot-2")).toBeNull();
  });

  it("lays few cards out in one row and more in rows of four", () => {
    expect([2, 4, 5, 12].map(gridColumns)).toEqual([2, 4, 4, 4]);
  });
});
