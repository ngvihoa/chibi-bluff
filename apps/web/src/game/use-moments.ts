"use client";

// Turns the latest engine events into short "moments" the table plays one at a time
// (docs/ui-design.md §5), plus floating coin changes per seat. The game state underneath is
// always current; moments are an overlay, and LocalHost pauses bots while they play.

import type { GameEvent, PlayerId, Role } from "@chibi-bluff/engine";
import { useEffect, useRef, useState } from "react";
import { MOMENT_MS } from "./local-host";

export type Moment =
  | {
      id: number;
      kind: "challenge";
      challengerId: PlayerId;
      claimantId: PlayerId;
      role: Role;
      truthful: boolean;
    }
  | { id: number; kind: "eliminated"; playerId: PlayerId };

export interface CoinFloat {
  id: number;
  playerId: PlayerId;
  delta: number;
}

const FLOAT_MS = 1_200;

/** Pure: which moments and coin floats a batch of events produces. */
export function momentsFrom(events: GameEvent[], nextId: () => number) {
  const moments: Moment[] = [];
  const floats: CoinFloat[] = [];
  for (const e of events) {
    if (e.type === "CHALLENGE_RESOLVED") {
      moments.push({
        id: nextId(),
        kind: "challenge",
        challengerId: e.challengerId,
        claimantId: e.claimantId,
        role: e.role,
        truthful: e.truthful,
      });
    } else if (e.type === "PLAYER_ELIMINATED") {
      moments.push({ id: nextId(), kind: "eliminated", playerId: e.playerId });
    } else if (e.type === "COINS_CHANGED" && e.reason !== "ELIMINATED") {
      floats.push({ id: nextId(), playerId: e.playerId, delta: e.delta });
    }
  }
  return { moments, floats };
}

export function useMoments(latest: GameEvent[]) {
  const [queue, setQueue] = useState<Moment[]>([]);
  const [floats, setFloats] = useState<CoinFloat[]>([]);
  const counter = useRef(0);
  const floatTimers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const { moments, floats: newFloats } = momentsFrom(latest, () => ++counter.current);
    if (moments.length) setQueue((q) => [...q, ...moments]);
    if (newFloats.length) {
      setFloats((f) => [...f, ...newFloats]);
      const ids = new Set(newFloats.map((x) => x.id));
      // Not tied to this effect's cleanup: a new batch must not cancel older floats' removal.
      const timer = setTimeout(() => {
        floatTimers.current.delete(timer);
        setFloats((f) => f.filter((x) => !ids.has(x.id)));
      }, FLOAT_MS);
      floatTimers.current.add(timer);
    }
  }, [latest]);

  useEffect(() => {
    const timers = floatTimers.current;
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, []);

  const current = queue[0] ?? null;
  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => setQueue((q) => q.slice(1)), MOMENT_MS[current.kind]);
    return () => clearTimeout(timer);
  }, [current]);

  return {
    current,
    floats,
    /** Lets the player tap a moment away early. */
    skip: () => setQueue((q) => q.slice(1)),
  };
}
