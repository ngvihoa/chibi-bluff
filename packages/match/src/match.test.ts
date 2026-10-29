import type { GameEvent, PlayerInput } from "@chibi-bluff/engine";
import { getLegalInputs } from "@chibi-bluff/engine";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Match, type MatchSeat } from "./match";
import { MOMENT_MS, momentPause } from "./pacing";
import { botFor } from "./persona";

const bots = (n: number): MatchSeat[] =>
  Array.from({ length: n }, (_, i) => ({ id: `bot-${i + 1}`, bot: botFor("duke", "normal") }));

async function runUntil(done: () => boolean, limitMs = 60 * 60 * 1000) {
  for (let t = 0; t < limitMs && !done(); t += 500) await vi.advanceTimersByTimeAsync(500);
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("Match", () => {
  it("plays a whole game between bots and reports every batch", async () => {
    const batches: GameEvent[][] = [];
    const match = new Match({ seats: bots(4), seed: "all-bots" }, (e) => batches.push(e));
    expect(batches).toHaveLength(0); // nothing happens before start()
    match.start();
    expect(batches[0]?.[0]?.type).toBe("GAME_STARTED");
    await runUntil(() => match.state.phase.kind === "GAME_OVER");
    expect(match.state.phase.kind).toBe("GAME_OVER");
    expect(batches.flat().some((e) => e.type === "GAME_OVER")).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("takes input only for seats a person controls", () => {
    const seats: MatchSeat[] = [{ id: "ann" }, ...bots(1)];
    const match = new Match({ seats, seed: "who-sends" }, () => {});
    match.start();
    expect(match.submit({ type: "PASS", playerId: "nobody" })).toBe("UNKNOWN_PLAYER");
    expect(match.submit({ type: "PASS", playerId: "bot-1" })).toBe("NOT_YOUR_TURN");
    expect(match.humans).toEqual(new Set(["ann"]));
    match.dispose();
  });

  it("lets a bot take over a person's seat and hand it back (docs/architecture.md §5.3)", async () => {
    const seats: MatchSeat[] = [{ id: "ann" }, { id: "ben" }];
    const match = new Match(
      { seats, seed: "takeover", timeouts: { actionTimeoutMs: null } },
      () => {},
    );
    match.start();
    const turn = () => match.state.turnNumber;
    // Nobody acts: with no action timer the game waits forever.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(turn()).toBe(1);
    const actor = match.state.turn.actorId;
    match.setBot(actor, botFor("captain", "easy"));
    expect(match.humans.has(actor)).toBe(false);
    await runUntil(() => turn() > 1, 60_000);
    expect(turn()).toBeGreaterThan(1);
    match.setBot(actor, null);
    expect(match.submit({ type: "PASS", playerId: actor })).not.toBe("NOT_YOUR_TURN");
    match.dispose();
  });

  it("pushes back a deadline that opens during a moment", async () => {
    // The person challenges a truthful claim and must then choose a card: that clock starts
    // only after the challenge moment.
    for (let n = 0; n < 40; n++) {
      const seats: MatchSeat[] = [{ id: "ann" }, ...bots(2)];
      const match = new Match(
        { seats, seed: `pause-${n}`, timeouts: { choiceTimeoutMs: 20_000 } },
        () => {},
      );
      match.start();
      const challenge = () =>
        getLegalInputs(match.state, "ann").find((i): i is PlayerInput => i.type === "CHALLENGE");
      await runUntil(() => challenge() !== undefined, 60_000);
      const input = challenge();
      if (input) match.submit(input);
      const { phase } = match.state;
      if (phase.kind === "AWAIT_INFLUENCE_LOSS" && phase.playerId === "ann") {
        expect(phase.deadline - Date.now()).toBe(20_000 + MOMENT_MS.challenge);
        match.dispose();
        return;
      }
      match.dispose();
    }
    expect.fail("no seed produced a lost challenge");
  });

  it("stops all timers when disposed", () => {
    const match = new Match({ seats: bots(3), seed: "dispose" }, () => {});
    match.start();
    match.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("snapshot / restore (docs/architecture.md §5.5)", () => {
  it("carries a game across a restart and plays it to the end", async () => {
    const original = new Match({ seats: bots(3), seed: "restart" }, () => {});
    original.start();
    await runUntil(() => original.state.turnNumber >= 4);
    // What the Durable Object stores is plain JSON.
    const saved = JSON.parse(JSON.stringify(original.snapshot()));
    const before = original.state;
    original.dispose();
    expect(vi.getTimerCount()).toBe(0);

    const events: GameEvent[] = [];
    const restored = Match.restore(saved, (e) => events.push(...e));
    expect(restored.state.turnNumber).toBe(before.turnNumber);
    expect(restored.state.players).toEqual(before.players);
    await runUntil(() => restored.state.phase.kind === "GAME_OVER");
    expect(events.some((e) => e.type === "GAME_OVER")).toBe(true);
  });

  it("moves deadlines on by the time the game was away", () => {
    const seats: MatchSeat[] = [{ id: "ann" }, { id: "ben" }];
    const match = new Match(
      { seats, seed: "away", timeouts: { actionTimeoutMs: 30_000 } },
      () => {},
    );
    match.start();
    const saved = match.snapshot();
    match.dispose();
    const deadline = saved.state.phase.deadline as number;
    vi.advanceTimersByTime(60_000); // down for a minute
    const restored = Match.restore(saved, () => {});
    expect(restored.state.phase.deadline).toBe(deadline + 60_000);
    expect(restored.humans).toEqual(new Set(["ann", "ben"]));
    restored.dispose();
  });
});

describe("momentPause", () => {
  it("plays a replacement reveal only for seats people control", () => {
    const drew: GameEvent[] = [{ type: "CARD_REPLACED", playerId: "ann", newRole: "duke" }];
    expect(momentPause(drew, new Set(["ann", "ben"]))).toBe(MOMENT_MS.drew);
    expect(momentPause(drew, "ann")).toBe(MOMENT_MS.drew);
    expect(momentPause(drew, new Set(["ben"]))).toBe(0);
    expect(momentPause(drew)).toBe(0);
  });
});
