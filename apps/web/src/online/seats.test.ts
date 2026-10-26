import type { RoomView } from "@chibi-bluff/protocol";
import { describe, expect, it, vi } from "vitest";
import { StickerHub } from "@/game/stickers";
import { seatsOf } from "./room-client";

const room = {
  seats: [
    { id: "a", name: "An", kind: "human", avatar: "duke", connected: true, standIn: false },
    { id: "b", name: "Bình", kind: "human", avatar: "captain", connected: false, standIn: false },
    { id: "c", name: "Chi", kind: "human", avatar: "contessa", connected: false, standIn: true },
    {
      id: "d",
      name: "Scruffy",
      kind: "bot",
      avatar: "ambassador",
      connected: true,
      standIn: false,
    },
  ],
} as unknown as RoomView;

describe("seatsOf", () => {
  it("names bots in the viewer's language and marks people who are away", () => {
    const seats = seatsOf(room, (avatar) => `bot:${avatar}`);
    expect(seats).toEqual([
      { id: "a", name: "An", kind: "human", avatar: "duke" },
      { id: "b", name: "Bình", kind: "human", avatar: "captain", status: "offline" },
      { id: "c", name: "Chi", kind: "human", avatar: "contessa", status: "standIn" },
      { id: "d", name: "bot:ambassador", kind: "bot", avatar: "ambassador" },
    ]);
  });
});

describe("StickerHub", () => {
  it("sends our stickers out and shows everyone's as they arrive", () => {
    const deliver = vi.fn();
    const hub = new StickerHub(deliver);
    const seen = vi.fn();
    const off = hub.subscribe(seen);
    hub.send("duke");
    expect(deliver).toHaveBeenCalledWith("duke");
    hub.show("b", "assassin");
    hub.show("b", "captain");
    expect(seen.mock.calls.map(([s]) => [s.seatId, s.sticker])).toEqual([
      ["b", "assassin"],
      ["b", "captain"],
    ]);
    expect(seen.mock.calls[1]?.[0].id).toBeGreaterThan(seen.mock.calls[0]?.[0].id);
    off();
    hub.show("b", "duke");
    expect(seen).toHaveBeenCalledTimes(2);
  });
});
