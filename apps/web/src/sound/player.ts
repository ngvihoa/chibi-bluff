// Plays the game's sounds with the Web Audio API (docs/ui-design.md §7). The files are small,
// decoded once and started from memory, so a sound lands with its animation.
//
// Browsers only let a page play sound after the player touched it: the audio context is made on
// the first tap or key press, and only while sound is on (so muted players never get one). On iOS
// the "ambient" audio session respects the ring/silent switch and leaves the player's music on.

import { SOUND_IDS, type SoundId } from "./cues";

const KEY = "chibi-bluff:sound";
const VOLUME = 0.8;

const file = (id: SoundId) => `/sounds/${id.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}.mp3`;

/** Every sound file, for the service worker to keep (public/sw.js lists the same files). */
export const SOUND_FILES = SOUND_IDS.map(file);

class SoundPlayer {
  private on: boolean;
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private readonly buffers = new Map<SoundId, AudioBuffer>();
  private readonly listeners = new Set<() => void>();

  constructor() {
    this.on = readSetting();
    const unlock = () => this.wake();
    window.addEventListener("pointerdown", unlock, { capture: true });
    window.addEventListener("keydown", unlock, { capture: true });
  }

  isOn = (): boolean => this.on;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  setOn(on: boolean): void {
    this.on = on;
    try {
      localStorage.setItem(KEY, on ? "on" : "off");
    } catch {
      // Without storage the choice lasts until the page closes.
    }
    if (on) this.wake();
    else void this.context?.suspend();
    for (const listener of this.listeners) listener();
  }

  play(id: SoundId, delayMs = 0): void {
    const { context, output } = this;
    if (!this.on || !context || !output || context.state !== "running") return;
    // Still loading (the first second after the first tap): better silent than late.
    const buffer = this.buffers.get(id);
    if (!buffer) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(output);
    source.start(context.currentTime + delayMs / 1000);
  }

  /** Makes (or resumes) the audio context; must run inside a tap or key press. */
  private wake(): void {
    if (!this.on) return;
    if (this.context) {
      if (this.context.state === "suspended") void this.context.resume();
      return;
    }
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = "ambient";
    const Context =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    const context = new Context();
    const output = context.createGain();
    output.gain.value = VOLUME;
    output.connect(context.destination);
    this.context = context;
    this.output = output;
    for (const id of SOUND_IDS) void this.load(context, id);
  }

  private async load(context: AudioContext, id: SoundId): Promise<void> {
    try {
      const response = await fetch(file(id));
      this.buffers.set(id, await context.decodeAudioData(await response.arrayBuffer()));
    } catch {
      // A missing sound stays silent; the game does not depend on it.
    }
  }
}

function readSetting(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

/** The one player for the page; null while prerendering. */
export const sound: SoundPlayer | null = typeof window === "undefined" ? null : new SoundPlayer();

export function playSound(id: SoundId, delayMs = 0): void {
  sound?.play(id, delayMs);
}
