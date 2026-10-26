import type { GameEvent, PlayerInput, PlayerView } from "@chibi-bluff/engine";
import { describe, expect, it, vi } from "vitest";
import type { SeatInfo } from "./host";
import { SocketHost } from "./socket-host";

const seats: SeatInfo[] = [
  { id: "a", name: "An", kind: "human", avatar: "duke" },
  { id: "b", name: "Bot", kind: "bot", avatar: "captain" },
];
const view = (turnNumber: number) => ({ viewerId: "a", turnNumber }) as unknown as PlayerView;
const started: GameEvent = { type: "GAME_STARTED", firstPlayerId: "a" };
const passed: GameEvent = { type: "PASSED", playerId: "b" };

describe("SocketHost", () => {
  it("starts from the server's picture and plays no animation for it", () => {
    const host = new SocketHost(seats, { view: view(1), legal: [], log: [started] }, () => {});
    expect(host.getSnapshot()).toMatchObject({ seats, log: [started], latest: [] });
  });

  it("appends updates to the log and hands their events to the table", () => {
    const host = new SocketHost(seats, { view: view(1), legal: [], log: [started] }, () => {});
    const listener = vi.fn();
    host.subscribe(listener);
    host.update({ view: view(2), legal: [], events: [passed] });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(host.getSnapshot()).toMatchObject({ log: [started, passed], latest: [passed] });
    expect(host.getSnapshot().view.turnNumber).toBe(2);
  });

  it("replaces everything on a resync (after reconnecting)", () => {
    const host = new SocketHost(seats, { view: view(1), legal: [], log: [started] }, () => {});
    host.update({ view: view(2), legal: [], events: [passed] });
    host.sync({ view: view(5), legal: [], log: [started] });
    expect(host.getSnapshot()).toMatchObject({ log: [started], latest: [] });
  });

  it("sends inputs to the server and leaves the verdict to it", () => {
    const send = vi.fn();
    const host = new SocketHost(seats, { view: view(1), legal: [], log: [] }, send);
    const input: PlayerInput = { type: "PASS", playerId: "a" };
    expect(host.submit(input)).toBeNull();
    expect(send).toHaveBeenCalledWith(input);
  });

  it("only notifies when the seats really change", () => {
    const host = new SocketHost(seats, { view: view(1), legal: [], log: [] }, () => {});
    const listener = vi.fn();
    host.subscribe(listener);
    host.setSeats(seats.map((s) => ({ ...s })));
    expect(listener).not.toHaveBeenCalled();
    host.setSeats([seats[0] as SeatInfo, { ...(seats[1] as SeatInfo), name: "Bot 2" }]);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
