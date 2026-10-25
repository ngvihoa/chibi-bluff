import { describe, expect, it } from "vitest";
import { applyInput } from "./game";
import type { Role } from "./rules";
import { getPlayer } from "./state";
import {
  challenge,
  coins,
  declare,
  hiddenCount,
  pass,
  pick,
  play,
  reject,
  setup,
  T0,
  TIMEOUT,
} from "./test-utils";
import { DEFAULT_TIMEOUTS } from "./types";
import { getEventsForViewer, getPlayerView } from "./view";

const hands = {
  an: ["duke", "ambassador"],
  binh: ["captain", "contessa"],
  chi: ["assassin", "duke"],
} as Record<string, Role[]>;
const RESPONSE = DEFAULT_TIMEOUTS.responseTimeoutMs;
const CHOICE = DEFAULT_TIMEOUTS.choiceTimeoutMs;

describe("timers", () => {
  it("R-DG-1: the response window has a deadline; silence counts as passing", () => {
    const { state } = play(setup({ hands }), declare("an", "tax"));
    expect(state.phase.deadline).toBe(T0 + RESPONSE);
    expect(reject(state, TIMEOUT, T0 + RESPONSE - 1)).toBe("DEADLINE_NOT_REACHED");
    const after = play(state, TIMEOUT, T0 + RESPONSE);
    expect(coins(after.state, "an")).toBe(5);
    expect(after.events.filter((e) => e.type === "PASSED")).toHaveLength(2);
  });

  it("R-DG-2: the window closes early once everyone eligible has passed", () => {
    let { state } = play(setup({ hands }), [declare("an", "foreignAid"), pass("binh")]);
    expect(state.phase.kind).toBe("AWAIT_ACTION_RESPONSE");
    ({ state } = play(state, pass("chi")));
    expect(coins(state, "an")).toBe(4);
  });

  it("R-DG-3: an unanswered card choice is made at random", () => {
    const { state } = play(setup({ hands }), [declare("an", "tax"), challenge("binh")]);
    expect(state.phase).toMatchObject({ kind: "AWAIT_INFLUENCE_LOSS", deadline: T0 + CHOICE });
    const after = play(state, [TIMEOUT, pick("an")], T0 + CHOICE);
    expect(hiddenCount(after.state, "binh")).toBe(1);
    expect(coins(after.state, "an")).toBe(5);
  });

  it("R-DG-3: an unanswered exchange keeps a valid random selection", () => {
    const { state } = play(setup({ hands }), [
      declare("an", "exchange"),
      pass("binh"),
      pass("chi"),
    ]);
    const after = play(state, TIMEOUT, T0 + CHOICE);
    expect(hiddenCount(after.state, "an")).toBe(2);
    expect(after.state.deck).toHaveLength(9);
    expect(after.state.turn.actorId).toBe("binh");
  });

  it("R-DG-7: with an action timer, an idle player takes Income", () => {
    const start = setup({ hands, config: { actionTimeoutMs: 30_000 } });
    start.phase = { kind: "AWAIT_ACTION", deadline: T0 + 30_000 };
    const { state } = play(start, TIMEOUT, T0 + 30_000);
    expect(coins(state, "an")).toBe(3);
    expect(state.phase).toEqual({ kind: "AWAIT_ACTION", deadline: T0 + 60_000 });
  });

  it("R-DG-7: an idle player with 10+ coins is forced to Coup the next player", () => {
    const start = setup({ hands, coins: { an: 10 }, config: { actionTimeoutMs: 30_000 } });
    start.phase = { kind: "AWAIT_ACTION", deadline: T0 + 30_000 };
    const { state } = play(start, TIMEOUT, T0 + 30_000);
    expect(state.turn.action).toEqual({ type: "coup", actorId: "an", targetId: "binh" });
  });

  it("R-DG-7: without an action timer, TIMEOUT does nothing during AWAIT_ACTION", () => {
    expect(reject(setup({ hands }), TIMEOUT, T0 + 1e9)).toBe("DEADLINE_NOT_REACHED");
  });
});

describe("hidden information", () => {
  it("R-DG-4: an unchallenged claim does not reveal the card", () => {
    const { state } = play(setup({ hands }), [declare("an", "tax"), pass("binh"), pass("chi")]);
    const an = getPlayerView(state, "binh").players[0];
    expect(an?.cards).toEqual([
      { revealed: false, role: null },
      { revealed: false, role: null },
    ]);
  });

  it("R-DG-6: a view shows own face-down cards only", () => {
    const view = getPlayerView(setup({ hands }), "binh");
    expect(view.players.map((p) => p.cards.map((c) => c.role))).toEqual([
      [null, null],
      ["captain", "contessa"],
      [null, null],
    ]);
    expect(JSON.stringify(view)).not.toMatch(/"(deck|rng|pending)"/);
    expect(view.deckSize).toBe(9);
  });

  it("R-DG-6: spectators see no face-down cards", () => {
    const view = getPlayerView(setup({ hands }), null);
    expect(view.players.flatMap((p) => p.cards.map((c) => c.role))).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it("R-DG-6: exchange options are visible only to the exchanging player", () => {
    const { state, events } = play(setup({ hands }), [
      declare("an", "exchange"),
      pass("binh"),
      pass("chi"),
    ]);
    const mine = getPlayerView(state, "an").phase;
    const theirs = getPlayerView(state, "binh").phase;
    expect(mine.kind === "AWAIT_EXCHANGE" && mine.options).toHaveLength(4);
    expect(theirs.kind === "AWAIT_EXCHANGE" && theirs.options).toBeNull();
    const started = (viewer: string) =>
      getEventsForViewer(events, viewer).find((e) => e.type === "EXCHANGE_STARTED");
    expect(started("an")).toMatchObject({ drawn: expect.any(Array) });
    expect(started("binh")).toMatchObject({ drawn: null });
  });

  it("R-DG-6: the replacement card after a won challenge is private", () => {
    const { events } = play(setup({ hands, revealed: { binh: [0] } }), [
      declare("an", "tax"),
      challenge("binh"),
      pick("an"),
    ]);
    const replaced = (viewer: string | null) =>
      getEventsForViewer(events, viewer).find((e) => e.type === "CARD_REPLACED");
    expect(replaced("an")).toMatchObject({ newRole: expect.any(String) });
    expect(replaced("chi")).toMatchObject({ newRole: null });
    expect(replaced(null)).toMatchObject({ newRole: null });
  });
});

describe("engine contract", () => {
  it("rejects inputs aimed at an earlier phase", () => {
    const start = setup({ hands });
    const { state } = play(start, declare("an", "tax"));
    const stale = { type: "CHALLENGE", playerId: "binh", phaseId: start.phaseId } as const;
    expect(reject(state, stale)).toBe("STALE_INPUT");
    const fresh = { type: "CHALLENGE", playerId: "binh", phaseId: state.phaseId } as const;
    expect(applyInput(state, fresh, T0).ok).toBe(true);
  });

  it("phaseId stays the same while players pass within one window", () => {
    const { state } = play(setup({ hands }), declare("an", "foreignAid"));
    expect(play(state, pass("binh")).state.phaseId).toBe(state.phaseId);
  });

  it("never mutates the state it is given", () => {
    const start = setup({ hands });
    const snapshot = structuredClone(start);
    play(start, [declare("an", "tax"), challenge("binh")]);
    applyInput(start, { type: "DECLARE", playerId: "an", action: "income" }, T0);
    expect(start).toEqual(snapshot);
    expect(getPlayer(start, "an").coins).toBe(2);
  });
});
