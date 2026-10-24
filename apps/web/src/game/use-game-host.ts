"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { GameHost, HostSnapshot } from "./host";

/** Subscribes a component to a GameHost's snapshots. */
export function useGameHost(host: GameHost): HostSnapshot {
  return useSyncExternalStore(host.subscribe, host.getSnapshot, host.getSnapshot);
}

/** Seconds left until `deadline` (ms timestamp), refreshed a few times per second. */
export function useSecondsLeft(deadline: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadline === null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadline]);
  return deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1000));
}
