// How bots decide in a game against bots (docs/bot-ai.md §7.4). Easy and normal bots answer at
// once on the main thread; the hard bot thinks in Web Workers so the table never stalls. Without
// workers (or if one fails) the hard bot thinks on the main thread with a shorter budget.

import { type BotContext, createHardBot, type Decision, getBot } from "@chibi-bluff/bots";
import type { BotDecider } from "@chibi-bluff/match";

/** Two workers: several hard bots are often asked at once (who challenges, who blocks). */
const WORKERS = 2;
/** Main-thread fallback: short enough not to be felt, still searching. */
const FALLBACK_MS = 60;

interface Pending {
  resolve: (decision: Decision) => void;
  reject: (error: unknown) => void;
}

class HardBotPool {
  private workers: Worker[] = [];
  private broken = false;
  private next = 0;
  private nextId = 0;
  private readonly pending = new Map<number, Pending>();
  private fallback: ReturnType<typeof createHardBot> | null = null;

  decide(ctx: BotContext): Promise<Decision> | Decision {
    const worker = this.worker();
    if (!worker) {
      this.fallback ??= createHardBot({ timeMs: FALLBACK_MS });
      return this.fallback.decide(ctx);
    }
    const id = this.nextId++;
    return new Promise<Decision>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ id, ctx });
    });
  }

  private worker(): Worker | null {
    if (this.broken || typeof Worker === "undefined") return null;
    if (this.workers.length === 0) {
      try {
        for (let i = 0; i < WORKERS; i++) {
          const worker = new Worker(new URL("./bot.worker.ts", import.meta.url), {
            type: "module",
          });
          worker.onmessage = (event: MessageEvent<{ id: number; decision: Decision }>) => {
            const job = this.pending.get(event.data.id);
            this.pending.delete(event.data.id);
            job?.resolve(event.data.decision);
          };
          worker.onerror = (event) => this.fail(event);
          this.workers.push(worker);
        }
      } catch (error) {
        this.fail(error);
        return null;
      }
    }
    const worker = this.workers[this.next % this.workers.length] as Worker;
    this.next += 1;
    return worker;
  }

  /** A worker failed: drop the workers and let pending decisions go (Match skips them). */
  private fail(error: unknown): void {
    this.broken = true;
    for (const worker of this.workers) worker.terminate();
    this.workers = [];
    for (const job of this.pending.values()) job.reject(error);
    this.pending.clear();
  }
}

const pool = new HardBotPool();

export const browserBotDecider: BotDecider = (bot, ctx) =>
  bot.difficulty === "hard" ? pool.decide(ctx) : getBot(bot.difficulty).decide(ctx);
