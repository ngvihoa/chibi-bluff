import type { PlayerView, Role, VisibleCard } from "@chibi-bluff/engine";
import { describe, expect, it } from "vitest";
import { hypergeometricAtLeastOne, probabilityHolds, unseenCounts } from "./belief";
import { createMemory } from "./memory";
import type { BotMemory, PlayerRecord } from "./types";

function rec(memory: BotMemory, id: string): PlayerRecord {
  const r = memory.players[id];
  if (!r) throw new Error(`no record for ${id}`);
  return r;
}

const hidden = (role: Role | null = null): VisibleCard => ({ revealed: false, role });
const shown = (role: Role): VisibleCard => ({ revealed: true, role });

/** "me" holds duke + captain; "an" has two hidden cards; "binh" lost a duke. 3 players → deck 9. */
function view(overrides: Partial<Record<string, VisibleCard[]>> = {}): PlayerView {
  const cards: Record<string, VisibleCard[]> = {
    me: [hidden("duke"), hidden("captain")],
    an: [hidden(), hidden()],
    binh: [shown("duke"), hidden()],
    ...overrides,
  };
  return {
    viewerId: "me",
    players: Object.entries(cards).map(([id, c]) => ({
      id,
      coins: 2,
      cards: c,
      eliminated: c.every((x) => x.revealed),
    })),
    deckSize: 9,
    turnNumber: 1,
    turn: { actorId: "me", action: null, block: null },
    phase: { kind: "AWAIT_ACTION", deadline: null },
    phaseId: 1,
  };
}

describe("card counting", () => {
  it("unseen = 3 − own face-down − all face-up", () => {
    expect(unseenCounts(view())).toEqual({
      duke: 1,
      captain: 2,
      assassin: 3,
      ambassador: 3,
      contessa: 3,
    });
  });

  it("hypergeometric: P(at least one of 3 copies in 2 cards from 6) = 0.8", () => {
    expect(hypergeometricAtLeastOne(6, 3, 2)).toBeCloseTo(0.8);
    expect(hypergeometricAtLeastOne(6, 0, 2)).toBe(0);
  });
});

describe("probabilityHolds", () => {
  it("is 0 when every copy is accounted for", () => {
    const v = view({ me: [hidden("duke"), hidden("duke")] });
    expect(unseenCounts(v).duke).toBe(0);
    expect(probabilityHolds(v, createMemory("me", ["me", "an", "binh"]), "an", "duke")).toBe(0);
  });

  it("is certain for the viewer's own cards", () => {
    const memory = createMemory("me", ["me", "an", "binh"]);
    expect(probabilityHolds(view(), memory, "me", "duke")).toBe(1);
    expect(probabilityHolds(view(), memory, "me", "contessa")).toBe(0);
  });

  it("rises with uncontested claims and falls with declined blocks", () => {
    const memory = createMemory("me", ["me", "an", "binh"]);
    const base = probabilityHolds(view(), memory, "an", "assassin");
    rec(memory, "an").claims.assassin = 2;
    const claimed = probabilityHolds(view(), memory, "an", "assassin");
    rec(memory, "an").claims.assassin = 0;
    rec(memory, "an").declined.assassin = 2;
    const declined = probabilityHolds(view(), memory, "an", "assassin");
    expect(claimed).toBeGreaterThan(base);
    expect(declined).toBeLessThan(base);
  });

  it("trusts claims less from a player caught bluffing", () => {
    const honest = createMemory("me", ["me", "an", "binh"]);
    rec(honest, "an").claims.contessa = 2;
    const liar = structuredClone(honest);
    rec(liar, "an").bluffsCaught = 1;
    expect(probabilityHolds(view(), liar, "an", "contessa")).toBeLessThan(
      probabilityHolds(view(), honest, "an", "contessa"),
    );
  });

  it("stays within [0, 1]", () => {
    const memory = createMemory("me", ["me", "an", "binh"]);
    rec(memory, "an").claims.ambassador = 50;
    const p = probabilityHolds(view(), memory, "an", "ambassador");
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThanOrEqual(1);
  });
});
