import type { RoomObject } from "./room-object";

/** Bindings and variables of the Worker (wrangler.jsonc). */
export interface Env {
  ROOMS: DurableObjectNamespace<RoomObject>;
  /** At most 5 rooms a minute per IP (wrangler.jsonc `ratelimits`). */
  ROOM_CREATION?: RateLimit;
  ALLOWED_ORIGINS?: string;
  STANDIN_MS?: string;
  GAME_SPEED?: string;
}
