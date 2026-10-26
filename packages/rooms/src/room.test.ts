import { ROOM_CODE_ALPHABET } from "@chibi-bluff/protocol";
import { describe, expect, it } from "vitest";
import {
  applyRoomAction,
  createRoom,
  isAbandoned,
  matchOptions,
  nextAvatar,
  type Room,
  type RoomAction,
  roomCode,
  roomView,
  seatByToken,
} from "./room";

const host = { seatId: "h", token: "token-host-000000", name: "Chủ" };
const arrive = (n: number) => ({ seatId: `p${n}`, token: `token-player-${n}0000`, name: `P${n}` });

/** Applies actions that must all succeed. */
function run(room: Room, ...actions: RoomAction[]): Room {
  return actions.reduce((r, action) => {
    const result = applyRoomAction(r, action);
    if (!result.ok) throw new Error(`${action.type} refused: ${result.error}`);
    return result.room;
  }, room);
}
const refusal = (room: Room, action: RoomAction) => {
  const result = applyRoomAction(room, action);
  return result.ok ? null : result.error;
};
const lobby = () => createRoom("ABCDE", host);
const bot = (n: number, room: Room): RoomAction => ({
  type: "addBot",
  by: "h",
  seatId: `b${n}`,
  name: `Bot ${n}`,
  avatar: nextAvatar(room),
});

describe("roomCode", () => {
  it("draws 5 characters from the unambiguous alphabet", () => {
    const code = roomCode(() => 0.999);
    expect(code).toHaveLength(5);
    expect([...code].every((c) => ROOM_CODE_ALPHABET.includes(c))).toBe(true);
    expect(roomCode(() => 0)).toBe("AAAAA");
  });
});

describe("joining", () => {
  it("seats people in arrival order with distinct looks", () => {
    const room = run(lobby(), { type: "join", ...arrive(1) }, { type: "join", ...arrive(2) });
    expect(room.seats.map((s) => s.id)).toEqual(["h", "p1", "p2"]);
    expect(new Set(room.seats.map((s) => s.avatar)).size).toBe(3);
    expect(seatByToken(room, "token-player-20000")?.id).toBe("p2");
    expect(seatByToken(room, "nope")).toBeNull();
  });

  it("holds at most 6 seats and refuses newcomers once the game started", () => {
    let room = lobby();
    for (let n = 1; n <= 5; n++) room = run(room, { type: "join", ...arrive(n) });
    expect(refusal(room, { type: "join", ...arrive(6) })).toBe("ROOM_FULL");
    expect(refusal(room, bot(1, room))).toBe("ROOM_FULL");
    const started = run(room, { type: "start", by: "h" });
    expect(refusal(started, { type: "join", ...arrive(7) })).toBe("GAME_IN_PROGRESS");
  });
});

describe("host powers", () => {
  it("only the host adds and removes bots, changes settings, kicks and starts", () => {
    const room = run(lobby(), { type: "join", ...arrive(1) });
    const asGuest: RoomAction[] = [
      { type: "addBot", by: "p1", seatId: "b1", name: "B", avatar: "duke" },
      { type: "settings", by: "p1", settings: { pace: "fast" } },
      { type: "kick", by: "p1", seatId: "h" },
      { type: "start", by: "p1" },
    ];
    for (const action of asGuest) expect(refusal(room, action)).toBe("NOT_HOST");
    expect(refusal(room, { type: "start", by: "stranger" })).toBe("NOT_IN_ROOM");
  });

  it("adds and removes bots, but never removes a person as a bot", () => {
    let room = run(lobby(), { type: "join", ...arrive(1) });
    room = run(room, bot(1, room));
    expect(room.seats.at(-1)).toMatchObject({ kind: "bot", id: "b1" });
    expect(refusal(room, { type: "removeBot", by: "h", seatId: "p1" })).toBe("NOT_A_BOT");
    expect(refusal(room, { type: "removeBot", by: "h", seatId: "zz" })).toBe("NO_SUCH_SEAT");
    room = run(room, { type: "removeBot", by: "h", seatId: "b1" });
    expect(room.seats.map((s) => s.id)).toEqual(["h", "p1"]);
  });

  it("kicks people but not bots or the host themself", () => {
    let room = run(lobby(), { type: "join", ...arrive(1) });
    room = run(room, bot(1, room));
    expect(refusal(room, { type: "kick", by: "h", seatId: "h" })).toBe("CANNOT_KICK");
    expect(refusal(room, { type: "kick", by: "h", seatId: "b1" })).toBe("CANNOT_KICK");
    room = run(room, { type: "kick", by: "h", seatId: "p1" });
    expect(room.seats.map((s) => s.id)).toEqual(["h", "b1"]);
  });

  it("merges settings and locks the lobby once the game starts", () => {
    let room = run(lobby(), { type: "settings", by: "h", settings: { actionTimeoutSeconds: 60 } });
    expect(room.settings).toMatchObject({ actionTimeoutSeconds: 60, pace: "normal" });
    expect(refusal(room, { type: "start", by: "h" })).toBe("NOT_ENOUGH_PLAYERS");
    room = run(room, bot(1, room), { type: "start", by: "h" });
    expect(room.status).toBe("playing");
    expect(refusal(room, { type: "settings", by: "h", settings: { pace: "fast" } })).toBe(
      "GAME_IN_PROGRESS",
    );
    expect(refusal(room, bot(2, room))).toBe("GAME_IN_PROGRESS");
    room = run(room, { type: "finish" });
    expect(room.status).toBe("finished");
    expect(refusal(room, { type: "finish" })).toBe("NOT_PLAYING");
  });
});

describe("leaving and dropping out", () => {
  it("leaves people who dropped out of the lobby out of the game", () => {
    let room = run(lobby(), { type: "join", ...arrive(1) }, { type: "join", ...arrive(2) });
    room = run(room, { type: "connection", seatId: "p1", connected: false });
    room = run(room, { type: "start", by: "h" });
    expect(room.seats.map((s) => s.id)).toEqual(["h", "p2"]);
    const alone = run(
      lobby(),
      { type: "join", ...arrive(1) },
      {
        type: "connection",
        seatId: "p1",
        connected: false,
      },
    );
    expect(refusal(alone, { type: "start", by: "h" })).toBe("NOT_ENOUGH_PLAYERS");
  });

  it("frees the seat in the lobby and passes hosting on", () => {
    let room = run(lobby(), { type: "join", ...arrive(1) }, { type: "join", ...arrive(2) });
    room = run(room, { type: "leave", seatId: "h" });
    expect(room.seats.map((s) => s.id)).toEqual(["p1", "p2"]);
    expect(room.hostId).toBe("p1");
  });

  it("keeps the seat mid-game so the game goes on", () => {
    let room = run(lobby(), { type: "join", ...arrive(1) }, { type: "start", by: "h" });
    room = run(room, { type: "leave", seatId: "p1" });
    expect(room.seats).toHaveLength(2);
    expect(room.seats[1]).toMatchObject({ id: "p1", connected: false });
  });

  it("hands hosting to someone online when the host drops, and back is not automatic", () => {
    let room = run(lobby(), { type: "join", ...arrive(1) });
    room = run(room, { type: "connection", seatId: "h", connected: false });
    expect(room.hostId).toBe("p1");
    room = run(room, { type: "connection", seatId: "h", connected: true });
    expect(room.hostId).toBe("p1");
  });

  it("lets a bot stand in mid-game until the person comes back", () => {
    let room = run(lobby(), { type: "join", ...arrive(1) });
    expect(refusal(room, { type: "standIn", seatId: "p1", on: true })).toBe("NOT_PLAYING");
    room = run(
      room,
      { type: "start", by: "h" },
      { type: "connection", seatId: "p1", connected: false },
      { type: "standIn", seatId: "p1", on: true },
    );
    expect(roomView(room, "h").seats[1]).toMatchObject({ connected: false, standIn: true });
    room = run(room, { type: "connection", seatId: "p1", connected: true });
    expect(roomView(room, "h").seats[1]).toMatchObject({ connected: true, standIn: false });
  });

  it("is abandoned once only bots remain", () => {
    let room = lobby();
    room = run(room, bot(1, room));
    expect(isAbandoned(room)).toBe(false);
    room = run(room, { type: "leave", seatId: "h" });
    expect(isAbandoned(room)).toBe(true);
  });
});

describe("what a seat sees", () => {
  it("never includes session tokens", () => {
    const room = run(lobby(), { type: "join", ...arrive(1) });
    const view = roomView(room, "p1");
    expect(view.you).toBe("p1");
    expect(JSON.stringify(view)).not.toContain("token-");
    expect(view.seats[1]).toEqual({
      id: "p1",
      name: "P1",
      kind: "human",
      avatar: room.seats[1]?.avatar,
      connected: true,
      standIn: false,
    });
  });
});

describe("matchOptions", () => {
  it("turns the room's settings into the game's pace and timers", () => {
    let room = run(lobby(), {
      type: "settings",
      by: "h",
      settings: { pace: "fast", actionTimeoutSeconds: 120, botDifficulty: "easy" },
    });
    room = run(room, bot(1, room));
    const options = matchOptions(room, "seed");
    expect(options.speed).toBe(0.55);
    expect(options.timeouts).toEqual({
      responseTimeoutMs: 10_000,
      choiceTimeoutMs: 15_000,
      actionTimeoutMs: 120_000,
    });
    expect(options.seats[0]).toEqual({ id: "h", bot: null });
    expect(options.seats[1]?.bot?.difficulty).toBe("easy");
    const untimed = matchOptions(lobby(), "seed");
    expect(untimed.timeouts?.actionTimeoutMs).toBeNull();
  });
});
