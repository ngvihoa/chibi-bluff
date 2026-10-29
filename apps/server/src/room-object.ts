// One Durable Object per room, found by its code (docs/architecture.md §5.5). It stays awake
// while anyone is connected (no hibernation), so the room's Match keeps running with ordinary
// timers, exactly as in the browser.

import { DurableObject } from "cloudflare:workers";
import type { AckFor, ClientMessage } from "@chibi-bluff/protocol";
import type { Env } from "./env";
import { type Connection, RoomCore } from "./room-core";

const number = (value: string | undefined) => (value ? Number(value) : undefined);

export class RoomObject extends DurableObject<Env> {
  private readonly core: RoomCore;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.core = new RoomCore({ standInMs: number(env.STANDIN_MS), speed: number(env.GAME_SPEED) });
  }

  /** RPC from the Worker (`POST /rooms`). Null if this code is already taken. */
  create(code: string, data: ClientMessage<"room:create">): AckFor<"room:create"> | null {
    return this.core.create(code, data);
  }

  /** The room's WebSocket (`/rooms/<code>/ws`, upgrade already checked by the Worker). */
  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected a WebSocket upgrade", { status: 426 });
    }
    const { 0: client, 1: socket } = new WebSocketPair();
    socket.accept();
    const connection: Connection = {
      send(frame) {
        try {
          socket.send(JSON.stringify(frame));
        } catch {
          // Already closing: the close event cleans up.
        }
      },
      close(code, reason) {
        try {
          socket.close(code, reason);
        } catch {
          // Already closed.
        }
      },
    };
    this.core.connect(connection);
    socket.addEventListener("message", (event) => {
      if (typeof event.data === "string") this.core.receive(connection, event.data);
    });
    const gone = () => this.core.disconnect(connection);
    socket.addEventListener("close", gone);
    socket.addEventListener("error", gone);
    return new Response(null, { status: 101, webSocket: client });
  }
}
