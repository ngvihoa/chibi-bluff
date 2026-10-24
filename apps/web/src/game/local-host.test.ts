import { getTheme } from "@chibi-bluff/themes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocalHost } from "./local-host";
import { createLocalSeats, HUMAN_ID } from "./seats";

const theme = getTheme();
const seats = (players: number, difficulty: "easy" | "normal" = "normal") =>
  createLocalSeats({ players, difficulty, playerName: "Bạn" }, theme, "vi", "seat-seed");

/** Runs timers until the game ends (bots and timeouts drive it). */
async function runToEnd(host: LocalHost, limitMs = 60 * 60 * 1000) {
  const step = 500;
  for (let t = 0; t < limitMs && host.getSnapshot().view.phase.kind !== "GAME_OVER"; t += step) {
    await vi.advanceTimersByTimeAsync(step);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("createLocalSeats", () => {
  it("seats you plus bots playing distinct characters", () => {
    const list = seats(6);
    expect(list[0]).toMatchObject({ id: HUMAN_ID, kind: "human", name: "Bạn" });
    expect(list.filter((s) => s.kind === "bot")).toHaveLength(5);
    expect(new Set(list.map((s) => s.avatar)).size).toBe(5);
    expect(list.slice(1).map((s) => s.name)).toEqual(
      list.slice(1).map((s) => theme.roles[s.avatar].botName.vi),
    );
  });
});

describe("LocalHost", () => {
  it("lets bots and timeouts play a whole game while the human never acts", async () => {
    // The human only ever sits still: on their turn nothing happens, so give them an action timer.
    const host = new LocalHost({
      seats: seats(4),
      seed: "idle-human",
      timeouts: { actionTimeoutMs: 10_000 },
    });
    await runToEnd(host);
    const { view } = host.getSnapshot();
    expect(view.phase.kind).toBe("GAME_OVER");
    host.dispose();
  });

  it("only shows the human their own face-down cards", () => {
    const host = new LocalHost({ seats: seats(3), seed: "hidden" });
    const { view } = host.getSnapshot();
    for (const p of view.players) {
      for (const card of p.cards) {
        if (p.id === HUMAN_ID) expect(card.role).not.toBeNull();
        else expect(card.role).toBeNull();
      }
    }
    host.dispose();
  });

  it("offers the human legal inputs on their turn and applies them", async () => {
    const host = new LocalHost({ seats: seats(2), seed: "human-turn" });
    // Wait until it is the human's turn (not just a chance to respond to a bot).
    const myTurn = () => {
      const { view } = host.getSnapshot();
      return view.phase.kind === "AWAIT_ACTION" && view.turn.actorId === HUMAN_ID;
    };
    for (let i = 0; i < 400 && !myTurn(); i++) await vi.advanceTimersByTimeAsync(500);
    const { legal, view } = host.getSnapshot();
    expect(view.turn.actorId).toBe(HUMAN_ID);
    const income = legal.find((i) => i.type === "DECLARE" && i.action === "income");
    expect(income).toBeDefined();
    if (!income) return;
    expect(host.submit(income)).toBeNull();
    expect(host.getSnapshot().view.turn.actorId).not.toBe(HUMAN_ID);
    host.dispose();
  });

  it("rejects inputs on behalf of other seats and reports engine errors", () => {
    const host = new LocalHost({ seats: seats(3), seed: "errors" });
    expect(host.submit({ type: "PASS", playerId: "bot-1" })).toBe("UNKNOWN_PLAYER");
    expect(host.submit({ type: "CHALLENGE", playerId: HUMAN_ID })).not.toBeNull();
    host.dispose();
  });

  it("keeps a redacted log and notifies subscribers", async () => {
    const host = new LocalHost({
      seats: seats(3),
      seed: "log",
      timeouts: { actionTimeoutMs: 5_000 },
    });
    const listener = vi.fn();
    host.subscribe(listener);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(listener).toHaveBeenCalled();
    const { log } = host.getSnapshot();
    expect(log[0]?.type).toBe("GAME_STARTED");
    for (const event of log) {
      if (event.type === "CARD_REPLACED" && event.playerId !== HUMAN_ID)
        expect(event.newRole).toBeNull();
      if (event.type === "EXCHANGE_STARTED" && event.playerId !== HUMAN_ID)
        expect(event.drawn).toBeNull();
    }
    host.dispose();
  });

  it("stops all timers when disposed", async () => {
    const host = new LocalHost({ seats: seats(4), seed: "dispose" });
    host.dispose();
    const before = host.getSnapshot();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(host.getSnapshot()).toBe(before);
    expect(vi.getTimerCount()).toBe(0);
  });
});
