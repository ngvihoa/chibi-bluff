"use client";

// Turns the latest engine events into short "moments" the table plays one at a time
// (docs/ui-design.md §5), plus floating coin changes per seat. The game state underneath is
// always current; moments are an overlay, and LocalHost pauses bots while they play.

import type { GameEvent, PlayerId, Role } from "@chibi-bluff/engine";
import { MOMENT_MS, momentPause } from "@chibi-bluff/match";
import { useEffect, useRef, useState } from "react";

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

/** Events of a turn that just ended, for the stage to summarise during the turn pause. */
export interface Recap {
  id: number;
  events: GameEvent[];
}

/** Pure: the recap a batch produces, if it ended a turn (and did not end the game). */
export function recapFrom(events: GameEvent[], id: number): Recap | null {
  if (!events.some((e) => e.type === "TURN_STARTED")) return null;
  if (events.some((e) => e.type === "GAME_OVER" || e.type === "GAME_STARTED")) return null;
  return { id, events: events.filter((e) => e.type !== "TURN_STARTED") };
}

export function useMoments(latest: GameEvent[], viewerId: PlayerId | null) {
  const [queue, setQueue] = useState<Moment[]>([]);
  const [recap, setRecap] = useState<Recap | null>(null);
  const [floats, setFloats] = useState<CoinFloat[]>([]);
  const counter = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const { moments, floats: newFloats } = momentsFrom(latest, () => ++counter.current);
    if (moments.length) setQueue((q) => [...q, ...moments]);
    const nextRecap = recapFrom(latest, ++counter.current);
    if (nextRecap) {
      setRecap(nextRecap);
      // Lasts as long as LocalHost holds the bots for this batch (moments + turn pause).
      const timer = setTimeout(
        () => {
          timers.current.delete(timer);
          setRecap((r) => (r?.id === nextRecap.id ? null : r));
        },
        momentPause(latest, viewerId),
      );
      timers.current.add(timer);
    }
    if (newFloats.length) {
      setFloats((f) => [...f, ...newFloats]);
      const ids = new Set(newFloats.map((x) => x.id));
      // Not tied to this effect's cleanup: a new batch must not cancel older floats' removal.
      const timer = setTimeout(() => {
        timers.current.delete(timer);
        setFloats((f) => f.filter((x) => !ids.has(x.id)));
      }, FLOAT_MS);
      timers.current.add(timer);
    }
  }, [latest, viewerId]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const t of pending) clearTimeout(t);
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
    recap,
    /** Lets the player tap a moment away early. */
    skip: () => setQueue((q) => q.slice(1)),
  };
}
