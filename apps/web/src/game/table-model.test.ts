import {
  type ActionType,
  getLegalInputs,
  getPlayerView,
  type PlayerInput,
  type PlayerView,
} from "@chibi-bluff/engine";
import { describe, expect, it } from "vitest";
import {
  actionButtons,
  activeSeat,
  arcOffset,
  deckCount,
  helpTopic,
  returningSlot,
  revealedCounts,
  stageClaim,
} from "./table-model";

/** A view of "you" holding duke + contessa, with the phase/turn overridden. */
function view(overrides: Partial<PlayerView> = {}, coins = 2): PlayerView {
  return {
    viewerId: "you",
    players: [
      {
        id: "you",
        coins,
        eliminated: false,
        cards: [
          { revealed: false, role: "duke" },
          { revealed: false, role: "contessa" },
        ],
      },
      {
        id: "bot-1",
        coins: 2,
        eliminated: false,
        cards: [
          { revealed: false, role: null },
          { revealed: false, role: null },
        ],
      },
    ],
    deckSize: 11,
    turnNumber: 1,
    turn: { actorId: "you", action: null, block: null },
    phase: { kind: "AWAIT_ACTION", deadline: null },
    phaseId: 1,
    ...overrides,
  };
}

const declare = (action: ActionType, targetId?: string): PlayerInput =>
  targetId === undefined
    ? { type: "DECLARE", playerId: "you", action }
    : { type: "DECLARE", playerId: "you", action, targetId };

describe("actionButtons", () => {
  it("lists all seven actions in a fixed order", () => {
    expect(actionButtons(view(), []).map((b) => b.action)).toEqual([
      "income",
      "foreignAid",
      "coup",
      "tax",
      "assassinate",
      "steal",
      "exchange",
    ]);
  });

  it("shows what each action costs or gains", () => {
    const money = actionButtons(view(), []).map((b) => [b.action, b.cost, b.gain]);
    expect(money).toEqual([
      ["income", 0, 1],
      ["foreignAid", 0, 2],
      ["coup", 7, 0],
      ["tax", 0, 3],
      ["assassinate", 3, 0],
      ["steal", 0, 2],
      ["exchange", 0, 0],
    ]);
  });

  it("flags claims you would be bluffing", () => {
    const buttons = actionButtons(view(), [declare("tax"), declare("steal", "bot-1")]);
    const byAction = Object.fromEntries(buttons.map((b) => [b.action, b]));
    expect(byAction.tax?.bluff).toBe(false); // you hold the Duke
    expect(byAction.steal?.bluff).toBe(true); // no Captain
    expect(byAction.income?.bluff).toBe(false); // no claim at all
  });

  it("explains why an action is unavailable", () => {
    const poor = actionButtons(view(), [declare("income")]);
    expect(poor.find((b) => b.action === "coup")?.reason).toBe("needCoins");
    const rich = actionButtons(view({}, 10), [declare("coup", "bot-1")]);
    expect(rich.find((b) => b.action === "tax")?.reason).toBe("mustCoup");
    expect(rich.find((b) => b.action === "coup")).toMatchObject({ enabled: true, reason: null });
    const theirs = actionButtons(
      view({ turn: { actorId: "bot-1", action: null, block: null } }),
      [],
    );
    expect(theirs.every((b) => b.reason === "notYourTurn")).toBe(true);
  });

  it("groups one input per target for targeted actions", () => {
    const b = actionButtons(view(), [declare("steal", "bot-1")]).find((x) => x.action === "steal");
    expect(b).toMatchObject({ targeted: true, enabled: true });
    expect(b?.inputs).toHaveLength(1);
  });

  it("matches the engine's legal inputs for a real game state", async () => {
    const { createGame, DEFAULT_TIMEOUTS } = await import("@chibi-bluff/engine");
    const { state } = createGame({ playerIds: ["you", "bot-1"], ...DEFAULT_TIMEOUTS }, "model", 0);
    const actor = state.turn.actorId;
    const buttons = actionButtons(getPlayerView(state, actor), getLegalInputs(state, actor));
    expect(buttons.filter((b) => b.enabled).map((b) => b.action)).toEqual(
      expect.arrayContaining(["income", "foreignAid", "tax", "steal", "exchange"]),
    );
  });
});

describe("activeSeat / stageClaim", () => {
  it("highlights the blocker and shows the blocking character during a block", () => {
    const v = view({
      turn: {
        actorId: "you",
        action: { type: "steal", actorId: "you", targetId: "bot-1" },
        block: { blockerId: "bot-1", role: "ambassador" },
      },
      phase: { kind: "AWAIT_BLOCK_RESPONSE", passed: [], deadline: 1 },
    });
    expect(activeSeat(v)).toBe("bot-1");
    expect(stageClaim(v)).toEqual({ playerId: "bot-1", role: "ambassador" });
  });

  it("shows the claimed character while others may respond", () => {
    const v = view({
      turn: {
        actorId: "bot-1",
        action: { type: "tax", actorId: "bot-1", targetId: null },
        block: null,
      },
      phase: { kind: "AWAIT_ACTION_RESPONSE", allowChallenge: true, passed: [], deadline: 1 },
    });
    expect(stageClaim(v)).toEqual({ playerId: "bot-1", role: "duke" });
    expect(activeSeat(v)).toBe("bot-1");
  });

  it("shows nothing on stage for general actions or between turns", () => {
    expect(stageClaim(view())).toBeNull();
    const aid = view({
      turn: {
        actorId: "bot-1",
        action: { type: "foreignAid", actorId: "bot-1", targetId: null },
        block: null,
      },
      phase: { kind: "AWAIT_ACTION_RESPONSE", allowChallenge: true, passed: [], deadline: 1 },
    });
    expect(stageClaim(aid)).toBeNull();
  });
});

describe("revealedCounts", () => {
  it("counts face-up cards per character across the table", () => {
    const v = view();
    v.players[1] = {
      ...(v.players[1] as PlayerView["players"][number]),
      cards: [
        { revealed: true, role: "duke" },
        { revealed: false, role: null },
      ],
    };
    expect(revealedCounts(v)).toEqual({
      duke: 1,
      assassin: 0,
      captain: 0,
      ambassador: 0,
      contessa: 0,
    });
  });
});

describe("replacement phase on the table", () => {
  it("shows the proven character and highlights who is drawing", () => {
    const v = view({
      phase: {
        kind: "AWAIT_REPLACEMENT",
        playerId: "bot-1",
        role: "duke",
        choices: 12,
        deadline: 1,
      },
    });
    expect(stageClaim(v)).toEqual({ playerId: "bot-1", role: "duke" });
    expect(activeSeat(v)).toBe("bot-1");
  });

  it("empties the proven card's slot and counts it in the deck while picking", () => {
    const replacing = (playerId: string) =>
      view({
        phase: { kind: "AWAIT_REPLACEMENT", playerId, role: "contessa", choices: 12, deadline: 1 },
      });
    expect(returningSlot(replacing("you"), "you")).toBe(1);
    expect(returningSlot(replacing("you"), "bot-1")).toBeNull();
    expect(returningSlot(replacing("bot-1"), "bot-1")).toBe(0);
    expect(deckCount(replacing("you"))).toBe(12);
    expect(returningSlot(view(), "you")).toBeNull();
    expect(deckCount(view())).toBe(11);
  });
});

describe("helpTopic", () => {
  it("opens the rules about what the table is waiting for", () => {
    const at = (phase: PlayerView["phase"]) => helpTopic(view({ phase }));
    expect(at({ kind: "AWAIT_ACTION", deadline: null })).toBe("actions");
    expect(
      at({ kind: "AWAIT_BLOCK_RESPONSE", passed: [], deadline: 1 } as PlayerView["phase"]),
    ).toBe("block");
    expect(
      at({
        kind: "AWAIT_INFLUENCE_LOSS",
        playerId: "you",
        reason: "COUP",
        deadline: 1,
      } as PlayerView["phase"]),
    ).toBe("influence");
    expect(
      at({
        kind: "AWAIT_REPLACEMENT",
        playerId: "you",
        role: "duke",
        choices: 9,
        deadline: 1,
      }),
    ).toBe("challenge");
    expect(at({ kind: "GAME_OVER", winnerId: "you", deadline: null })).toBe("overview");
  });
});

describe("arcOffset (desktop seats, docs/ui-design.md §4.2)", () => {
  it("puts the middle seats highest and the ends lowest, symmetrically", () => {
    expect(arcOffset(0, 1)).toBe(0);
    const five = [0, 1, 2, 3, 4].map((i) => arcOffset(i, 5));
    expect(five[2]).toBe(0);
    expect(five[0]).toBe(five[4]);
    expect(five[1]).toBe(five[3]);
    expect(five[0]).toBeGreaterThan(five[1] as number);
    expect(five[1]).toBeGreaterThan(0);
    const two = [0, 1].map((i) => arcOffset(i, 2));
    expect(two[0]).toBe(two[1]);
  });
});
