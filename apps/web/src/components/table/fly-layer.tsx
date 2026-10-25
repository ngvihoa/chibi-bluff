"use client";

// Face-down cards flying between the deck and a seat (docs/ui-design.md §5b):
//   Exchange: 2 cards deck → seat, later 2 cards seat → deck.
//   Won challenge: the proven card seat → deck, then the replacement deck → seat.
// Anchors are found in the DOM: `[data-deck-pile]` and `[data-seat="<playerId>"]`.

import type { GameEvent, PlayerId } from "@chibi-bluff/engine";
import { type ThemeLocale, type ThemeManifest, themeAssetUrl } from "@chibi-bluff/themes";
import { useEffect, useRef, useState } from "react";
import { MOMENT_MS } from "@/game/local-host";

interface Flight {
  id: number;
  from: DOMRect;
  to: DOMRect;
  delay: number;
}

const FLIGHT_MS = 600;
const STAGGER_MS = 140;

type Leg = { playerId: PlayerId; toDeck: boolean; count: number };

/** Pure: which card movements a batch of events implies. */
export function legsFrom(events: GameEvent[]): Leg[] {
  const legs: Leg[] = [];
  for (const e of events) {
    if (e.type === "EXCHANGE_STARTED") legs.push({ playerId: e.playerId, toDeck: false, count: 2 });
    if (e.type === "EXCHANGE_COMPLETED")
      legs.push({ playerId: e.playerId, toDeck: true, count: 2 });
    if (e.type === "CARD_RETURNED") legs.push({ playerId: e.playerId, toDeck: true, count: 1 });
    if (e.type === "CARD_REPLACED") legs.push({ playerId: e.playerId, toDeck: false, count: 1 });
  }
  return legs;
}

export function FlyLayer({
  latest,
  theme,
}: {
  latest: GameEvent[];
  theme: ThemeManifest;
  locale: ThemeLocale;
}) {
  const [flights, setFlights] = useState<Flight[]>([]);
  const counter = useRef(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const legs = legsFrom(latest);
    if (legs.length === 0) return;
    const deck = document.querySelector("[data-deck-pile]")?.getBoundingClientRect();
    if (!deck) return;
    // A challenge overlay covers the table first; fly once it has played.
    let delay = latest.some((e) => e.type === "CHALLENGE_RESOLVED") ? MOMENT_MS.challenge : 0;
    const next: Flight[] = [];
    for (const leg of legs) {
      const seat = document
        .querySelector(`[data-seat="${CSS.escape(leg.playerId)}"]`)
        ?.getBoundingClientRect();
      if (!seat) continue;
      for (let i = 0; i < leg.count; i++) {
        next.push({
          id: ++counter.current,
          from: leg.toDeck ? seat : deck,
          to: leg.toDeck ? deck : seat,
          delay,
        });
        delay += STAGGER_MS;
      }
      delay += FLIGHT_MS / 2;
    }
    setFlights((f) => [...f, ...next]);
  }, [latest]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-30">
      {flights.map((flight) => (
        <FlyingCard
          key={flight.id}
          flight={flight}
          src={themeAssetUrl(theme, theme.cardBack)}
          onDone={() => setFlights((f) => f.filter((x) => x.id !== flight.id))}
        />
      ))}
    </div>
  );
}

function FlyingCard({ flight, src, onDone }: { flight: Flight; src: string; onDone: () => void }) {
  const ref = useRef<HTMLImageElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: each flight animates exactly once
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const center = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    const a = center(flight.from);
    const b = center(flight.to);
    const animation = el.animate(
      [
        {
          transform: `translate(${a.x}px, ${a.y}px) translate(-50%, -50%) rotate(-8deg) scale(0.9)`,
          opacity: 1,
        },
        {
          transform: `translate(${(a.x + b.x) / 2}px, ${Math.min(a.y, b.y) - 40}px) translate(-50%, -50%) rotate(6deg) scale(1.1)`,
          opacity: 1,
          offset: 0.5,
        },
        {
          transform: `translate(${b.x}px, ${b.y}px) translate(-50%, -50%) rotate(0deg) scale(0.8)`,
          opacity: 0.2,
        },
      ],
      {
        duration: FLIGHT_MS,
        delay: flight.delay,
        easing: "cubic-bezier(.3,.8,.4,1)",
        fill: "both",
      },
    );
    animation.onfinish = onDone;
    animation.oncancel = onDone;
    return () => animation.cancel();
  }, []);
  return (
    // biome-ignore lint/performance/noImgElement: decorative card back for a short animation
    <img
      ref={ref}
      src={src}
      alt=""
      className="absolute top-0 left-0 w-9 drop-shadow-[0_3px_0_#1d1230]"
    />
  );
}
