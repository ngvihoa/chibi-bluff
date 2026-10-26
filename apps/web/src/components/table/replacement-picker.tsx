"use client";

// Full-screen pick of a replacement card after a won challenge (R-DG-8, docs/ui-design.md §5b):
//   1. spread: face-down cards fly out of the deck pile into a grid;
//   2. reveal: the tapped card grows to the centre and flips, for your eyes only;
//   3. return: it flies into the empty hand slot while the rest go back to the deck.
// Anchors are found in the DOM: `[data-deck-pile]` and `[data-hand-slot="<index>"]`.

import type { GameEvent, PlayerId, Role } from "@chibi-bluff/engine";
import { MOMENT_MS } from "@chibi-bluff/match";
import type { ThemeLocale, ThemeManifest } from "@chibi-bluff/themes";
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CardBack } from "@/components/cards/card-back";
import { CardFace } from "@/components/cards/card-face";

const SPREAD_DELAY_MS = 250;
const SPREAD_MS = 650;
const SPREAD_STAGGER_MS = 60;
const GROW_MS = 700;
const FLIP_MS = 700;
const RETURN_MS = 1_000;
/** How long the drawn card stays face up; LocalHost holds the bots for the whole sequence. */
const HOLD_MS = MOMENT_MS.drew - RETURN_MS;

type Stage = "pick" | "reveal" | "return";

/** Pure: the role you just drew, if this batch has it. */
export function drawnRole(events: GameEvent[], viewerId: PlayerId): Role | null {
  for (const e of events) {
    if (e.type === "CARD_REPLACED" && e.playerId === viewerId && e.newRole) return e.newRole;
  }
  return null;
}

/** Pure: grid columns for `count` cards: one row when few, otherwise rows of 4. */
export function gridColumns(count: number): number {
  return Math.max(1, Math.min(4, count));
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const center = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
/** Transform that puts an element laid out at `from` onto the rect `to`. */
const onto = (from: DOMRect, to: DOMRect, rotate = 0) => {
  const a = center(from);
  const b = center(to);
  return `translate(${b.x - a.x}px, ${b.y - a.y}px) scale(${to.width / from.width}) rotate(${rotate}deg)`;
};

export interface ReplacementPickerProps {
  theme: ThemeManifest;
  locale: ThemeLocale;
  viewerId: PlayerId;
  /** Cards to pick from: the deck plus the proven card (R-DG-8). */
  choices: number;
  /** Hand slot the new card lands in. */
  slot: number;
  /** Still your pick (false once sent or timed out). */
  picking: boolean;
  latest: GameEvent[];
  text: { claim: string; title: string; drew: string; hint: string; card: (n: number) => string };
  ability: (role: Role) => string;
  timer: ReactNode;
  onPick: (index: number) => void;
  onDone: () => void;
}

export function ReplacementPicker({
  theme,
  locale,
  viewerId,
  choices,
  slot,
  picking,
  latest,
  text,
  ability,
  timer,
  onPick,
  onDone,
}: ReplacementPickerProps) {
  const [stage, setStage] = useState<Stage>("pick");
  const [picked, setPicked] = useState<number | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const cards = useRef<(HTMLButtonElement | null)[]>([]);
  const big = useRef<HTMLDivElement>(null);
  const flipper = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const caption = useRef<HTMLParagraphElement>(null);
  // The claim and hint describe the phase you opened in; keep them once the engine moves on.
  const [opening] = useState(text);
  const done = useRef(onDone);
  done.current = onDone;

  // A timeout picks for you; the card shown is then any one of the grid.
  const chosen = picked ?? Math.floor((choices - 1) / 2);

  // 1. Spread out of the deck pile.
  useLayoutEffect(() => {
    if (reducedMotion()) return;
    const deck = document.querySelector("[data-deck-pile]")?.getBoundingClientRect();
    backdrop.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, fill: "both" });
    if (!deck) return;
    cards.current.forEach((el, i) => {
      if (!el) return;
      el.animate(
        [
          { transform: onto(el.getBoundingClientRect(), deck, -12), opacity: 0.6 },
          { transform: "none", opacity: 1 },
        ],
        {
          duration: SPREAD_MS,
          delay: SPREAD_DELAY_MS + i * SPREAD_STAGGER_MS,
          easing: "cubic-bezier(.3,1.3,.6,1)",
          fill: "backwards",
        },
      );
    });
  }, []);

  // The engine answered: show what you drew.
  useEffect(() => {
    const drawn = drawnRole(latest, viewerId);
    if (drawn && stage === "pick") {
      setRole(drawn);
      setStage("reveal");
    }
  }, [latest, viewerId, stage]);

  // 2. Grow from the chosen card and flip.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the reveal starts
  useLayoutEffect(() => {
    if (stage !== "reveal") return;
    const timer = setTimeout(() => setStage("return"), HOLD_MS);
    const from = cards.current[chosen]?.getBoundingClientRect();
    const el = big.current;
    if (!reducedMotion() && el && from) {
      el.animate([{ transform: onto(el.getBoundingClientRect(), from) }, { transform: "none" }], {
        duration: GROW_MS,
        easing: "cubic-bezier(.3,1.2,.5,1)",
        fill: "backwards",
      });
      flipper.current?.animate(
        [{ transform: "rotateY(-180deg)" }, { transform: "rotateY(0deg)" }],
        {
          duration: FLIP_MS,
          delay: GROW_MS - 200,
          easing: "ease-in-out",
          fill: "backwards",
        },
      );
      caption.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 300,
        delay: GROW_MS + FLIP_MS - 300,
        fill: "backwards",
      });
    }
    return () => clearTimeout(timer);
  }, [stage]);

  // 3. Into the hand; the rest back to the deck.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the return starts
  useEffect(() => {
    if (stage !== "return") return;
    const timer = setTimeout(() => done.current(), RETURN_MS);
    if (reducedMotion()) return () => clearTimeout(timer);
    const deck = document.querySelector("[data-deck-pile]")?.getBoundingClientRect();
    const hand = document.querySelector(`[data-hand-slot="${slot}"]`)?.getBoundingClientRect();
    const el = big.current;
    if (el && hand) {
      el.animate([{ transform: "none" }, { transform: onto(el.getBoundingClientRect(), hand) }], {
        duration: RETURN_MS - 150,
        easing: "cubic-bezier(.5,0,.3,1)",
        fill: "forwards",
      });
    }
    if (deck) {
      cards.current.forEach((card, i) => {
        if (!card || i === chosen) return;
        card.animate(
          [
            { transform: "none", opacity: 0.35 },
            { transform: onto(card.getBoundingClientRect(), deck, 10), opacity: 0 },
          ],
          { duration: 600, delay: i * 30, easing: "ease-in", fill: "forwards" },
        );
      });
    }
    backdrop.current?.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 400,
      delay: RETURN_MS - 400,
      fill: "forwards",
    });
    return () => clearTimeout(timer);
  }, [stage]);

  const pick = (index: number) => {
    if (!picking || picked !== null) return;
    setPicked(index);
    onPick(index);
  };

  const columns = gridColumns(choices);
  // Rows of four fill a phone; a short row gets bigger cards.
  const cardRem = columns < 4 ? 6 : 4.5;
  const revealed = stage !== "pick";

  return (
    <div className="fixed inset-0 z-30">
      <div ref={backdrop} className="absolute inset-0 bg-bg/95 backdrop-blur-sm" />
      {/* biome-ignore lint/a11y/noStaticElementInteractions: tapping the backdrop only shortens the reveal; the cards are the real controls */}
      <div
        role="presentation"
        onClick={() => stage === "reveal" && setStage("return")}
        className={`relative mx-auto flex h-full max-w-md flex-col gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-6 transition-opacity duration-300 ${
          stage === "return" ? "opacity-0" : ""
        }`}
      >
        <section
          aria-live="polite"
          className="flex items-center gap-3 rounded-3xl border-3 border-outline bg-panel px-4 py-2 shadow-hard-sm"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted">{opening.claim}</p>
            <h2 className="text-game-sm text-xl">{revealed ? text.drew : text.title}</h2>
          </div>
          {!revealed && timer}
        </section>

        <div className="flex flex-1 flex-col justify-center gap-5">
          <div
            className="mx-auto flex flex-wrap justify-center gap-3"
            style={{ maxWidth: `${columns * cardRem + (columns - 1) * 0.75}rem` }}
          >
            {Array.from({ length: choices }, (_, i) => (
              <button
                // biome-ignore lint/suspicious/noArrayIndexKey: a card is its position in the deck
                key={i}
                ref={(el) => {
                  cards.current[i] = el;
                }}
                type="button"
                disabled={!picking || picked !== null}
                onClick={() => pick(i)}
                aria-label={text.card(i + 1)}
                style={{ width: `${cardRem}rem` }}
                className={`transition duration-300 enabled:hover:-translate-y-1.5 enabled:active:scale-95 ${
                  revealed ? (i === chosen ? "invisible" : "opacity-35") : ""
                } ${picked === i && !revealed ? "-translate-y-2 scale-105" : ""}`}
              >
                <CardBack theme={theme} locale={locale} label="" compact className="w-full" />
              </button>
            ))}
          </div>
          <p className={`min-h-10 text-center text-sm text-muted ${revealed ? "invisible" : ""}`}>
            {opening.hint}
          </p>
        </div>
      </div>

      {revealed && role && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center [perspective:900px]">
          <div ref={big} className="w-44">
            <div ref={flipper} className="relative [transform-style:preserve-3d]">
              <div className="[backface-visibility:hidden] [transform:rotateY(180deg)]">
                <CardBack theme={theme} locale={locale} label="" className="w-full" />
              </div>
              <div className="absolute inset-0 [backface-visibility:hidden]">
                <CardFace
                  theme={theme}
                  character={role}
                  locale={locale}
                  ability={ability(role)}
                  owned
                  className="w-full"
                />
              </div>
            </div>
            <p ref={caption} className="text-game-sm mt-3 text-center text-xl">
              {theme.roles[role].name[locale]}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
