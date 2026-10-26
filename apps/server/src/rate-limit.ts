// Token buckets for per-socket rate limits (docs/architecture.md §5.4).

export class Bucket {
  private tokens: number;
  private last: number;

  /** Holds up to `capacity` tokens, refilled at `perSecond`. */
  constructor(
    private readonly capacity: number,
    private readonly perSecond: number,
    private readonly now: () => number = Date.now,
  ) {
    this.tokens = capacity;
    this.last = now();
  }

  /** Spends a token if there is one. */
  take(): boolean {
    const now = this.now();
    this.tokens = Math.min(
      this.capacity,
      this.tokens + ((now - this.last) / 1000) * this.perSecond,
    );
    this.last = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

export interface Limit {
  capacity: number;
  perSecond: number;
}

export interface Limits {
  /** Lobby actions: join, settings, bots, kick, start. */
  room: Limit;
  /** Creating rooms. */
  create: Limit;
  /** Game inputs. */
  input: Limit;
  /** Stickers: one every 3 seconds (docs/ui-design.md §6). */
  sticker: Limit;
}

export const DEFAULT_LIMITS: Limits = {
  room: { capacity: 10, perSecond: 2 },
  create: { capacity: 3, perSecond: 1 / 20 },
  input: { capacity: 20, perSecond: 10 },
  sticker: { capacity: 1, perSecond: 1 / 3 },
};
