"use client";

import { setSoundOn, useSoundOn } from "@/sound/use-sound";

/** Speaker button in the table header: sound on or off, remembered on this device (§7). */
export function SoundToggle({ labels }: { labels: { on: string; off: string } }) {
  const on = useSoundOn();
  return (
    <button
      type="button"
      onClick={() => setSoundOn(!on)}
      aria-pressed={on}
      aria-label={on ? labels.on : labels.off}
      title={on ? labels.on : labels.off}
      className="grid size-[2.375rem] place-items-center rounded-full border-3 border-outline bg-panel text-gold shadow-hard-sm"
    >
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden fill="none" stroke="currentColor">
        <path
          d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"
          fill="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        {on ? (
          <path
            d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"
            strokeWidth="2"
            strokeLinecap="round"
          />
        ) : (
          <path d="M16 9.5l5 5M21 9.5l-5 5" strokeWidth="2.2" strokeLinecap="round" />
        )}
      </svg>
    </button>
  );
}
