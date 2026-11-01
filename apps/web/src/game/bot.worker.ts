// Runs the hard bot off the main thread (docs/bot-ai.md §7.4): it thinks for ~250 ms a move,
// which would otherwise freeze the table while it does. See bot-decider.ts.

import { type BotContext, createHardBot } from "@chibi-bluff/bots";

const hard = createHardBot();

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<{ id: number; ctx: BotContext }>) => void) | null;
  postMessage(message: unknown): void;
};

scope.onmessage = (event) => {
  const { id, ctx } = event.data;
  scope.postMessage({ id, decision: hard.decide(ctx) });
};
