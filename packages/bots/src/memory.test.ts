import type { DeclaredAction, GameEvent } from "@chibi-bluff/engine";
import { describe, expect, it } from "vitest";
import { createMemory, observe } from "./memory";
import type { BotMemory, PlayerRecord } from "./types";

function rec(memory: BotMemory, id: string): PlayerRecord {
  const r = memory.players[id];
  if (!r) throw new Error(`no record for ${id}`);
  return r;
}

const IDS = ["me", "an", "binh"];
const tax: DeclaredAction = { type: "tax", actorId: "an", targetId: null };
const stealFromMe: DeclaredAction = { type: "steal", actorId: "an", targetId: "me" };
const turn = (n: number): GameEvent => ({ type: "TURN_STARTED", playerId: "an", turnNumber: n });

describe("bot memory", () => {
  it("counts an uncontested claim once the action resolves", () => {
    const memory = observe(createMemory("me", IDS), [
      turn(1),
      { type: "ACTION_DECLARED", action: tax },
      { type: "PASSED", playerId: "me" },
      { type: "ACTION_RESOLVED", action: tax },
    ]);
    expect(memory.players.an?.claims.duke).toBe(1);
    expect(memory.openClaims).toEqual([]);
  });

  it("does not count a claim that was challenged; records a caught bluff", () => {
    const memory = observe(createMemory("me", IDS), [
      turn(1),
      { type: "ACTION_DECLARED", action: tax },
      { type: "CHALLENGED", challengerId: "binh", claimantId: "an", role: "duke" },
      {
        type: "CHALLENGE_RESOLVED",
        challengerId: "binh",
        claimantId: "an",
        role: "duke",
        truthful: false,
      },
      { type: "ACTION_FAILED", action: tax, reason: "BLUFF_CAUGHT" },
    ]);
    expect(memory.players.an?.claims.duke).toBe(0);
    expect(memory.players.an?.bluffsCaught).toBe(1);
    expect(memory.players.binh?.challengesMade).toBe(1);
  });

  it("forgets evidence about a role once the card is proven and shuffled away", () => {
    let memory = createMemory("me", IDS);
    rec(memory, "an").claims.duke = 3;
    memory = observe(memory, [
      turn(5),
      { type: "ACTION_DECLARED", action: tax },
      { type: "CHALLENGED", challengerId: "me", claimantId: "an", role: "duke" },
      {
        type: "CHALLENGE_RESOLVED",
        challengerId: "me",
        claimantId: "an",
        role: "duke",
        truthful: true,
      },
    ]);
    expect(memory.players.an?.claims.duke).toBe(0);
    expect(memory.players.an?.truthfulReveals).toBe(1);
  });

  it("holds a grudge against whoever targets it and notes declined blocks", () => {
    const memory = observe(createMemory("me", IDS), [
      turn(1),
      { type: "ACTION_DECLARED", action: stealFromMe },
      { type: "PASSED", playerId: "me" },
      { type: "ACTION_RESOLVED", action: stealFromMe },
    ]);
    expect(memory.grudges.an).toBe(1);
    expect(memory.players.me?.declined.captain).toBe(1);
    expect(memory.players.me?.declined.ambassador).toBe(1);
    expect(memory.players.an?.claims.captain).toBe(1);
  });

  it("counts an unchallenged block as a claim", () => {
    const memory = observe(createMemory("me", IDS), [
      turn(1),
      { type: "ACTION_DECLARED", action: stealFromMe },
      { type: "BLOCK_DECLARED", block: { blockerId: "me", role: "ambassador" } },
      {
        type: "ACTION_BLOCKED",
        action: stealFromMe,
        block: { blockerId: "me", role: "ambassador" },
      },
    ]);
    expect(memory.players.me?.claims.ambassador).toBe(1);
  });

  it("halves evidence after an exchange", () => {
    let memory = createMemory("me", IDS);
    rec(memory, "an").claims.duke = 3;
    memory = observe(memory, [{ type: "EXCHANGE_COMPLETED", playerId: "an" }]);
    expect(memory.players.an?.claims.duke).toBe(1);
  });

  it("is pure", () => {
    const memory = createMemory("me", IDS);
    const snapshot = structuredClone(memory);
    observe(memory, [turn(1), { type: "ACTION_DECLARED", action: tax }]);
    expect(memory).toEqual(snapshot);
  });
});
