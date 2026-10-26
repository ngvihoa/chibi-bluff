// A game played on the server, seen through one seat (docs/architecture.md §4.2). The server
// already redacts everything for this seat; the host only keeps the log and builds snapshots,
// so the table works exactly as it does with LocalHost.

import type { EngineError, GameEvent, PlayerInput } from "@chibi-bluff/engine";
import type { GameSync, GameUpdate } from "@chibi-bluff/protocol";
import type { GameHost, HostSnapshot, SeatInfo } from "./host";

const MAX_LOG = 300;

export class SocketHost implements GameHost {
  private snapshot: HostSnapshot;
  private readonly listeners = new Set<() => void>();

  constructor(
    seats: SeatInfo[],
    sync: GameSync,
    /** Sends an input to the server; its answer arrives as the next update. */
    private readonly send: (input: PlayerInput) => void,
  ) {
    this.snapshot = { seats, ...sync, log: sync.log.slice(-MAX_LOG), latest: [] };
  }

  getSnapshot = (): HostSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** The server decides; rejected inputs (e.g. too late) simply change nothing. */
  submit(input: PlayerInput): EngineError | null {
    this.send(input);
    return null;
  }

  dispose(): void {
    this.listeners.clear();
  }

  /** A full picture after (re)joining: replaces the log, plays no animations. */
  sync(sync: GameSync): void {
    this.set({ ...this.snapshot, ...sync, log: sync.log.slice(-MAX_LOG), latest: [] });
  }

  update({ view, legal, events }: GameUpdate): void {
    const log: GameEvent[] = [...this.snapshot.log, ...events].slice(-MAX_LOG);
    this.set({ ...this.snapshot, view, legal, log, latest: events });
  }

  /** Names, bots and avatars can change while playing (e.g. a bot takes over a seat). */
  setSeats(seats: SeatInfo[]): void {
    if (sameSeats(seats, this.snapshot.seats)) return;
    this.set({ ...this.snapshot, seats, latest: [] });
  }

  private set(snapshot: HostSnapshot) {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
}

function sameSeats(a: SeatInfo[], b: SeatInfo[]) {
  return (
    a.length === b.length &&
    a.every((s, i) => {
      const t = b[i];
      return t && s.id === t.id && s.name === t.name && s.kind === t.kind && s.avatar === t.avatar;
    })
  );
}
