import type { RoomObject } from "./room-object";

/** Bindings and variables of the Worker (wrangler.jsonc). */
export interface Env {
  ROOMS: DurableObjectNamespace<RoomObject>;
  ALLOWED_ORIGINS?: string;
  STANDIN_MS?: string;
  GAME_SPEED?: string;
}
