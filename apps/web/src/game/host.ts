// The UI talks to a game only through a GameHost (docs/architecture.md §4.2), so the same table
// works for local bot games (LocalHost) and, later, online rooms (SocketHost).

import type {
  EngineError,
  GameEvent,
  PlayerId,
  PlayerInput,
  PlayerView,
  Role,
} from "@chibi-bluff/engine";

export interface SeatInfo {
  id: PlayerId;
  name: string;
  kind: "human" | "bot";
  /** Character whose art is used as this seat's avatar. */
  avatar: Role;
}

export interface HostSnapshot {
  seats: SeatInfo[];
  /** What the local player is allowed to see (viewerId null = spectating). */
  view: PlayerView;
  /** Inputs the local player may send right now. */
  legal: PlayerInput[];
  /** Redacted events since the game started, oldest first. */
  log: GameEvent[];
  /** Events produced by the latest update, for animations. */
  latest: GameEvent[];
}

export interface GameHost {
  getSnapshot(): HostSnapshot;
  subscribe(listener: () => void): () => void;
  /** Sends the local player's input. Returns the engine error if it was rejected. */
  submit(input: PlayerInput): EngineError | null;
  dispose(): void;
}
