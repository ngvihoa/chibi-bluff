import type {
  DeclaredAction,
  PlayerInput,
  PlayerView,
  Role,
  VisibleCard,
} from "@chibi-bluff/engine";
import { createRng } from "@chibi-bluff/engine";
import { describe, expect, it } from "vitest";
import { easyBot } from "./easy";
import { createMemory } from "./memory";
import { normalBot } from "./normal";
import { PERSONALITIES } from "./personality";
import { type SeatSpec, simulateGame, simulateMatch } from "./sim/simulate";
import type { BotMemory } from "./types";

const hidden = (role: Role | null = null): VisibleCard => ({ revealed: false, role });
const shown = (role: Role): VisibleCard => ({ revealed: true, role });
const IDS = ["me", "an", "binh"];

interface Spec {
  me: VisibleCard[];
  an?: VisibleCard[];
  binh?: VisibleCard[];
  coins?: Partial<Record<string, number>>;
  phase: PlayerView["phase"];
  action?: DeclaredAction | null;
  block?: PlayerView["turn"]["block"];
}

function view(spec: Spec): PlayerView {
  const cards: Record<string, VisibleCard[]> = {
    me: spec.me,
    an: spec.an ?? [hidden(), hidden()],
    binh: spec.binh ?? [hidden(), hidden()],
  };
  return {
    viewerId: "me",
    players: IDS.map((id) => ({
      id,
      coins: spec.coins?.[id] ?? 2,
      cards: cards[id] as VisibleCard[],
      eliminated: (cards[id] as VisibleCard[]).every((c) => c.revealed),
    })),
    deckSize: 9,
    turnNumber: 3,
    turn: {
      actorId: spec.action?.actorId ?? "me",
      action: spec.action ?? null,
      block: spec.block ?? null,
    },
    phase: spec.phase,
    phaseId: 7,
  };
}

function decide(v: PlayerView, legal: PlayerInput[], memory: BotMemory = createMemory("me", IDS)) {
  return normalBot.decide({
    view: v,
    legal,
    memory,
    personality: PERSONALITIES.balanced,
    rng: createRng("normal-test"),
  }).input;
}

const respond: PlayerView["phase"] = {
  kind: "AWAIT_ACTION_RESPONSE",
  allowChallenge: true,
  passed: [],
  deadline: 1,
};
const PASS: PlayerInput = { type: "PASS", playerId: "me" };
const CHALLENGE: PlayerInput = { type: "CHALLENGE", playerId: "me" };
const assassinateMe: DeclaredAction = { type: "assassinate", actorId: "an", targetId: "me" };

describe("normal bot: hard rules", () => {
  it("always challenges a claim when every copy of that character is accounted for", () => {
    const v = view({
      me: [hidden("duke"), hidden("duke")],
      binh: [shown("duke"), hidden()],
      phase: respond,
      action: { type: "tax", actorId: "an", targetId: null },
    });
    expect(decide(v, [PASS, CHALLENGE])).toEqual(CHALLENGE);
  });

  it("blocks with a Contessa it really holds when assassinated", () => {
    const v = view({
      me: [hidden("contessa"), hidden("duke")],
      phase: respond,
      action: assassinateMe,
    });
    const contessa: PlayerInput = { type: "BLOCK", playerId: "me", role: "contessa" };
    expect(decide(v, [PASS, CHALLENGE, contessa])).toEqual(contessa);
  });

  it("never just passes when assassinated on its last card", () => {
    const v = view({
      me: [hidden("duke"), shown("captain")],
      phase: respond,
      action: assassinateMe,
    });
    const contessa: PlayerInput = { type: "BLOCK", playerId: "me", role: "contessa" };
    expect(decide(v, [PASS, CHALLENGE, contessa])).not.toEqual(PASS);
  });

  it("challenges a block when every copy of the blocking character is accounted for", () => {
    const v = view({
      me: [hidden("captain"), hidden("ambassador")],
      an: [hidden(), hidden()],
      binh: [shown("ambassador"), shown("ambassador")],
      phase: { kind: "AWAIT_BLOCK_RESPONSE", passed: [], deadline: 1 },
      action: { type: "steal", actorId: "me", targetId: "an" },
      block: { blockerId: "an", role: "ambassador" },
    });
    expect(decide(v, [PASS, CHALLENGE])).toEqual(CHALLENGE);
  });
});

describe("normal bot: card choices", () => {
  it("gives up the less useful card and keeps a Contessa against a rich assassin", () => {
    const memory = createMemory("me", IDS);
    (memory.players.an as BotMemory["players"][string]).claims.assassin = 2;
    const v = view({
      me: [hidden("contessa"), hidden("ambassador")],
      coins: { an: 6 },
      phase: { kind: "AWAIT_INFLUENCE_LOSS", playerId: "me", reason: "COUP", deadline: 1 },
    });
    const loss = (cardIndex: number): PlayerInput => ({
      type: "CHOOSE_LOSS",
      playerId: "me",
      cardIndex,
    });
    expect(decide(v, [loss(0), loss(1)], memory)).toEqual(loss(1));
  });

  it("keeps the cards it has been claiming", () => {
    const memory = createMemory("me", IDS);
    (memory.players.me as BotMemory["players"][string]).claims.captain = 2;
    const v = view({
      me: [hidden("captain"), hidden("ambassador")],
      coins: { me: 6 },
      phase: { kind: "AWAIT_INFLUENCE_LOSS", playerId: "me", reason: "COUP", deadline: 1 },
    });
    const loss = (cardIndex: number): PlayerInput => ({
      type: "CHOOSE_LOSS",
      playerId: "me",
      cardIndex,
    });
    expect(decide(v, [loss(0), loss(1)], memory)).toEqual(loss(1));
  });

  it("prefers two different strong characters when exchanging", () => {
    const v = view({
      me: [hidden("ambassador"), hidden("ambassador")],
      phase: {
        kind: "AWAIT_EXCHANGE",
        playerId: "me",
        options: ["ambassador", "ambassador", "duke", "assassin"],
        keepCount: 2,
        deadline: 1,
      },
    });
    const keep = (k: number[]): PlayerInput => ({
      type: "CHOOSE_EXCHANGE",
      playerId: "me",
      keep: k,
    });
    const legal = [
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 2],
      [1, 3],
      [2, 3],
    ].map(keep);
    expect(decide(v, legal)).toEqual(keep([2, 3]));
  });
});

describe("normal bot: play strength", () => {
  const seat = (label: string, policy = normalBot): SeatSpec => ({
    label,
    policy,
    personality: PERSONALITIES.balanced,
  });

  it.each([2, 4, 6])("only sends legal inputs at a %i-player table", (n) => {
    for (let g = 0; g < 30; g++) {
      const seats = Array.from({ length: n }, (_, i) => seat(`s${i}`, i % 2 ? easyBot : normalBot));
      expect(() => simulateGame(seats, `normal-legal-${n}-${g}`)).not.toThrow();
    }
  });

  // docs/bot-ai.md §10 target: Normal beats Easy ≥ 70% one-on-one (measured ~72% over 2,000 games).
  it("beats the easy bot one-on-one", () => {
    const result = simulateMatch([seat("normal"), seat("easy", easyBot)], 800, "normal-vs-easy");
    expect(result.winRate.normal).toBeGreaterThan(0.67);
  });
});
