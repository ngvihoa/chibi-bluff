// Sticker plumbing shared by the hosts: who sent what, as a stream of short-lived shows.

import type { PlayerId, Role } from "@chibi-bluff/engine";
import type { StickerChannel, StickerShow } from "./host";

export class StickerHub implements StickerChannel {
  private readonly listeners = new Set<(show: StickerShow) => void>();
  private next = 0;

  /** `deliver` sends our own sticker on its way (online: to the server, which echoes it back). */
  constructor(private readonly deliver: (sticker: Role) => void) {}

  send(sticker: Role): void {
    this.deliver(sticker);
  }

  subscribe(listener: (show: StickerShow) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Someone's sticker arrived: show it. */
  show(seatId: PlayerId, sticker: Role): void {
    const show = { id: ++this.next, seatId, sticker };
    for (const listener of this.listeners) listener(show);
  }
}
