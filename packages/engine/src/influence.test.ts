import { describe, expect, it } from "vitest";
import { getLegalInputs } from "./legal";
import type { Role } from "./rules";
import { getPlayer } from "./state";
import {
  block,
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
  setup,
} from "./test-utils";
import { getPlayerView } from "./view";

const hands = {
  an: ["assassin", "duke"],
  binh: ["captain", "duke"],
  chi: ["captain", "contessa"],
} as Record<string, Role[]>;

describe("losing influence", () => {
  it("R-IN-1: the player chooses which card to give up", () => {
    const start = setup({ hands, coins: { an: 7 } });
    let { state } = play(start, declare("an", "coup", "binh"));
    expect(reject(state, loseCard("an", 0))).toBe("NOT_YOUR_TURN");
    expect(reject(state, loseCard("binh", 2))).toBe("INVALID_CARD");
    ({ state } = play(state, loseCard("binh", 1)));
    expect(getPlayer(state, "binh").cards).toEqual([
      { role: "captain", revealed: false },
      { role: "duke", revealed: true },
    ]);
  });

  it("R-IN-1: a face-down card is required; with one card left there is no choice", () => {
    const start = setup({ hands, coins: { an: 7 }, revealed: { binh: [1] } });
    const { state, events } = play(start, declare("an", "coup", "binh"));
    expect(eventTypes(events)).toContain("PLAYER_ELIMINATED");
    expect(state.phase.kind).toBe("AWAIT_ACTION");
  });

  it("R-IN-2: lost cards are face up for everyone", () => {
    const start = setup({ hands, coins: { an: 7 } });
    const { state } = play(start, [declare("an", "coup", "binh"), loseCard("binh", 0)]);
    expect(getPlayerView(state, "chi").players[1]?.cards[0]).toEqual({
      revealed: true,
      role: "captain",
    });
  });

  it("R-IN-3: an eliminated player returns their coins and takes no further part", () => {
    const start = setup({ hands, coins: { an: 7, binh: 4 }, revealed: { binh: [1] } });
    const { state, events } = play(start, declare("an", "coup", "binh"));
    expect(events).toContainEqual({
      type: "COINS_CHANGED",
      playerId: "binh",
      delta: -4,
      reason: "ELIMINATED",
    });
    expect(coins(state, "binh")).toBe(0);
    expect(state.turn.actorId).toBe("chi");
    expect(getLegalInputs(state, "binh")).toEqual([]);
    expect(reject(state, declare("binh", "income"))).toBe("PLAYER_ELIMINATED");
  });

  it("R-IN-4: the target of an assassination can lose both cards (failed challenge + assassination)", () => {
    const start = setup({ hands, coins: { an: 3 } });
    let { state } = play(start, [declare("an", "assassinate", "binh"), challenge("binh")]);
    ({ state } = play(state, [loseCard("binh", 1), pick("an")]));
    // Block window reopens for the target; binh has no Contessa and passes.
    ({ state } = play(state, pass("binh")));
    expect(hiddenCount(state, "binh")).toBe(0);
    expect(state.turn.actorId).toBe("chi");
  });

  it("R-IN-4: a caught Contessa bluff plus the assassination eliminates the target", () => {
    const start = setup({ hands, coins: { an: 3 } });
    let { state } = play(start, [
      declare("an", "assassinate", "binh"),
      block("binh", "contessa"),
      challenge("an"),
    ]);
    ({ state } = play(state, loseCard("binh", 0)));
    expect(hiddenCount(state, "binh")).toBe(0);
  });

  it("R-IN-5: if the target is already out when the action resolves, nothing more happens", () => {
    const start = setup({ hands, coins: { an: 3 }, revealed: { binh: [1] } });
    const { state, events } = play(start, [
      declare("an", "assassinate", "binh"),
      challenge("binh"),
      pick("an"),
    ]);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "ACTION_FAILED", reason: "TARGET_ELIMINATED" }),
    );
    expect(eventTypes(events)).not.toContain("ACTION_RESOLVED");
    expect(coins(state, "an")).toBe(0);
  });
});

describe("end of game", () => {
  it("R-EN-1: the game ends when one player has influence left", () => {
    const start = setup({
      hands: { an: ["duke", "duke"], binh: ["captain", "contessa"] },
      coins: { an: 7 },
      revealed: { binh: [0] },
    });
    const { state, events } = play(start, declare("an", "coup", "binh"));
    expect(state.phase).toEqual({ kind: "GAME_OVER", winnerId: "an", deadline: null });
    expect(events.at(-1)).toEqual({ type: "GAME_OVER", winnerId: "an" });
    expect(state.pending).toEqual([]);
    expect(reject(state, declare("an", "income"))).toBe("GAME_OVER");
    expect(getLegalInputs(state, "an")).toEqual([]);
  });

  it("R-EN-1: the game can end mid-turn when a challenger loses their last card", () => {
    const start = setup({
      hands: { an: ["duke", "duke"], binh: ["captain", "contessa"] },
      revealed: { binh: [0] },
    });
    const { state, events } = play(start, [declare("an", "tax"), challenge("binh")]);
    expect(state.phase.kind).toBe("GAME_OVER");
    expect(eventTypes(events)).not.toContain("TURN_STARTED");
  });
});
