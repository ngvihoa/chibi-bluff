"use client";

// Stickers (docs/ui-design.md §6): one per character, shown at the sender's seat for 2.5 s,
// one every 3 s per person, and other people's can be muted.

import { type PlayerId, ROLES, type Role } from "@chibi-bluff/engine";
import type { ThemeLocale, ThemeManifest } from "@chibi-bluff/themes";
import { useCallback, useEffect, useRef, useState } from "react";
import type { StickerChannel, StickerShow } from "@/game/host";
import { Avatar } from "./avatar";

export const STICKER_MS = 2_500;
export const STICKER_COOLDOWN_MS = 3_000;
const MUTE_KEY = "chibi-bluff:mute-stickers";

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Stickers on show right now, keyed by seat, plus sending with its cooldown. */
export function useStickers(channel: StickerChannel | undefined, viewerId: PlayerId | null) {
  const [shown, setShown] = useState<Map<PlayerId, StickerShow>>(new Map());
  const [muted, setMutedState] = useState(false);
  const [coolUntil, setCoolUntil] = useState(0);
  const [, tick] = useState(0);
  const mutedRef = useRef(false);

  useEffect(() => {
    mutedRef.current = readMuted();
    setMutedState(mutedRef.current);
  }, []);

  useEffect(() => {
    if (!channel) return;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const off = channel.subscribe((show) => {
      if (mutedRef.current && show.seatId !== viewerId) return;
      setShown((m) => new Map(m).set(show.seatId, show));
      const timer = setTimeout(() => {
        timers.delete(timer);
        setShown((m) => {
          if (m.get(show.seatId)?.id !== show.id) return m;
          const next = new Map(m);
          next.delete(show.seatId);
          return next;
        });
      }, STICKER_MS);
      timers.add(timer);
    });
    return () => {
      off();
      for (const t of timers) clearTimeout(t);
    };
  }, [channel, viewerId]);

  // Re-render once the cooldown is over so the button wakes up.
  useEffect(() => {
    const left = coolUntil - Date.now();
    if (left <= 0) return;
    const timer = setTimeout(() => tick((n) => n + 1), left);
    return () => clearTimeout(timer);
  }, [coolUntil]);

  const setMuted = useCallback((value: boolean) => {
    mutedRef.current = value;
    setMutedState(value);
    try {
      localStorage.setItem(MUTE_KEY, value ? "1" : "0");
    } catch {
      // Not remembered, but still applied for this game.
    }
  }, []);

  const send = useCallback(
    (sticker: Role) => {
      if (!channel || Date.now() < coolUntil) return;
      setCoolUntil(Date.now() + STICKER_COOLDOWN_MS);
      channel.send(sticker);
    },
    [channel, coolUntil],
  );

  return {
    available: channel !== undefined,
    shown,
    muted,
    setMuted,
    coolingDown: Date.now() < coolUntil,
    send,
  };
}

/** A sticker popping up over a seat. */
export function StickerBubble({
  sticker,
  theme,
  locale,
  className = "",
}: {
  sticker: Role;
  theme: ThemeManifest;
  locale: ThemeLocale;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={`pointer-events-none absolute z-20 flex animate-[pop-in_300ms_cubic-bezier(.3,1.6,.6,1)] items-center gap-1 rounded-2xl border-3 border-outline bg-ink py-0.5 pr-2.5 pl-0.5 shadow-hard-sm ${className}`}
    >
      <Avatar theme={theme} character={sticker} className="size-8 border-2" />
      <span className="text-sm font-extrabold whitespace-nowrap text-outline">
        {theme.roles[sticker].sticker.text[locale]}
      </span>
    </div>
  );
}

/** The five stickers to choose from, and the mute switch. */
export function StickerPicker({
  theme,
  locale,
  coolingDown,
  muted,
  muteLabel,
  onSend,
  onMute,
}: {
  theme: ThemeManifest;
  locale: ThemeLocale;
  coolingDown: boolean;
  muted: boolean;
  muteLabel: string;
  onSend: (sticker: Role) => void;
  onMute: (muted: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-5 gap-2">
        {ROLES.map((role) => (
          <button
            key={role}
            type="button"
            disabled={coolingDown}
            onClick={() => onSend(role)}
            className="flex flex-col items-center gap-1 rounded-2xl border-3 border-outline bg-ink p-1 shadow-hard-sm transition active:translate-y-0.5 disabled:opacity-50"
          >
            <Avatar theme={theme} character={role} className="size-10 border-2" />
            <span className="text-[11px] leading-tight font-extrabold text-outline">
              {theme.roles[role].sticker.text[locale]}
            </span>
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm font-bold">
        <input
          type="checkbox"
          checked={muted}
          onChange={(e) => onMute(e.target.checked)}
          className="size-5 accent-gold"
        />
        {muteLabel}
      </label>
    </div>
  );
}
