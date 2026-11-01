"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { Cue, SoundId } from "./cues";
import { playSound, sound } from "./player";

const noop = () => () => {};

/** Whether sound is on (assumed on while prerendering). */
export function useSoundOn(): boolean {
  return useSyncExternalStore(
    sound?.subscribe ?? noop,
    () => sound?.isOn() ?? true,
    () => true,
  );
}

export function setSoundOn(on: boolean): void {
  sound?.setOn(on);
}

/** Plays `cues` once when the component shows them (e.g. a moment overlay appearing). */
export function useCues(cues: readonly Cue[] | (() => readonly Cue[])): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per mount
  useEffect(() => {
    for (const cue of typeof cues === "function" ? cues() : cues) playSound(cue.id, cue.delayMs);
  }, []);
}

export function cue(id: SoundId, delayMs = 0): Cue {
  return { id, delayMs };
}

/** Renders nothing; plays `cues` when it appears. */
export function PlayCues({ cues }: { cues: readonly Cue[] }) {
  useCues(cues);
  return null;
}
