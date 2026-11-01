import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { GameEvent } from "@chibi-bluff/engine";
import { describe, expect, it } from "vitest";
import { CUE_GAP_MS, cuesFor, SOUND_IDS } from "./cues";
import { SOUND_FILES } from "./player";

const action = { type: "tax", actorId: "a" } as never;

describe("cuesFor", () => {
  it("plays the deal, a claim, coins and your own turn, spaced out in order", () => {
    const events: GameEvent[] = [
      { type: "GAME_STARTED", firstPlayerId: "you" },
      { type: "ACTION_DECLARED", action },
      { type: "COINS_CHANGED", playerId: "a", delta: 3, reason: "TAX" } as GameEvent,
      { type: "TURN_STARTED", playerId: "you", turnNumber: 1 },
    ];
    expect(cuesFor(events, "you")).toEqual([
      { id: "deal", delayMs: 0 },
      { id: "declare", delayMs: CUE_GAP_MS },
      { id: "coinGain", delayMs: 2 * CUE_GAP_MS },
      { id: "turn", delayMs: 3 * CUE_GAP_MS },
    ]);
  });

  it("rings only for your turn, and stays quiet when an eliminated player's coins go", () => {
    const events: GameEvent[] = [
      { type: "TURN_STARTED", playerId: "bot-1", turnNumber: 4 },
      { type: "COINS_CHANGED", playerId: "bot-2", delta: -5, reason: "ELIMINATED" } as GameEvent,
    ];
    expect(cuesFor(events, "you")).toEqual([]);
  });

  it("plays each sound once per batch: a steal is one gain and one loss", () => {
    const events = [
      { type: "COINS_CHANGED", playerId: "a", delta: 2, reason: "STEAL" },
      { type: "COINS_CHANGED", playerId: "b", delta: -2, reason: "STEAL" },
      { type: "COINS_CHANGED", playerId: "c", delta: 1, reason: "INCOME" },
    ] as GameEvent[];
    expect(cuesFor(events, "you").map((c) => c.id)).toEqual(["coinGain", "coinLoss"]);
  });

  it("leaves challenges and eliminations to their moments on screen", () => {
    const events = [
      { type: "CHALLENGED", challengerId: "a", claimantId: "b", role: "duke" },
      { type: "CHALLENGE_RESOLVED" },
      { type: "PLAYER_ELIMINATED", playerId: "b" },
      { type: "BLOCK_DECLARED", block: {} },
      { type: "INFLUENCE_LOST", playerId: "b", role: "duke", reason: "CHALLENGE" },
    ] as unknown as GameEvent[];
    expect(cuesFor(events, "you").map((c) => c.id)).toEqual(["block", "loseCard"]);
  });
});

describe("sound files", () => {
  it("has a file for every sound, and the service worker keeps them all", () => {
    const web = join(__dirname, "../..");
    const sw = readFileSync(join(web, "public/sw.js"), "utf8");
    expect(SOUND_FILES).toHaveLength(SOUND_IDS.length);
    for (const file of SOUND_FILES) {
      expect(() => readFileSync(join(web, "public", file))).not.toThrow();
      expect(sw).toContain(`"${file.slice("/sounds/".length, -".mp3".length)}"`);
    }
  });
});
