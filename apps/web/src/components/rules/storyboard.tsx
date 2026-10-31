"use client";

// Learn to play in 2 minutes (docs/ui-design.md §10.2): pages side by side with scroll snapping,
// one idea and one scene each. Tap the left third to go back, anywhere else to go on; swipe,
// arrow keys and the progress bar work too. The page number lives in the URL (#3) for sharing.
// Pages never advance on their own: newcomers read at their own pace.

import { getTheme } from "@chibi-bluff/themes";
import Link from "next/link";
import { type MouseEvent, useCallback, useEffect, useRef, useState } from "react";
import { GameButton } from "@/components/game-button";
import { useI18n } from "@/i18n/client";
import { format } from "@/i18n/format";
import { markLearnSeen } from "./learn-hint";
import { SCENES } from "./scenes";
import { hashForSlide, keyStep, type Step, slideFromHash, stepSlide, tapStep } from "./story-nav";

/** Where page `index` starts in the track. Every page is exactly as wide as the track; an
 * element's offsetLeft would also count the margin around the centred storyboard on wide screens. */
const pageLeft = (track: HTMLElement, index: number) => index * track.clientWidth;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Storyboard() {
  const { locale, dict } = useI18n();
  const t = dict.rules.learn;
  const theme = getTheme();
  const total = t.slides.length;
  const [current, setCurrent] = useState(0);
  const track = useRef<HTMLElement>(null);
  const slides = useRef<(HTMLElement | null)[]>([]);
  const opening = useRef<number | null>(null);

  const names = Object.fromEntries(
    Object.entries(theme.roles).map(([role, skin]) => [role, skin.name[locale]]),
  );
  const fill = (text: string) => format(text, { ...names, currency: theme.currency[locale] });

  /** The page a button sent us to while the track is still sliding there. Pages passed on the
   * way do not count, and further taps step on from it: fast taps are never lost. */
  const heading = useRef<number | null>(null);

  const show = useCallback((index: number, smooth = true) => {
    if (!track.current) return;
    heading.current = index;
    setCurrent(index);
    track.current.scrollTo({
      left: pageLeft(track.current, index),
      behavior: smooth && !reducedMotion() ? "smooth" : "auto",
    });
  }, []);

  const go = useCallback(
    (step: Step) => show(stepSlide(heading.current ?? current, step, total)),
    [current, show, total],
  );

  // Open at the page in the URL, then follow whichever page is in view (swipes and scrolls
  // included). Watching starts only once the opening page is in place, or the first page would
  // briefly count as "in view" and overwrite the URL.
  useEffect(() => {
    const root = track.current;
    if (!root) return;
    // Read once: in development React runs effects twice, and by the second run the URL already
    // shows the page this component wrote, not the one it was opened at.
    opening.current ??= slideFromHash(window.location.hash, total);
    const start = opening.current;
    root.scrollLeft = pageLeft(root, start);
    setCurrent(start);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = slides.current.indexOf(entry.target as HTMLElement);
          if (index < 0) continue;
          if (heading.current !== null && index !== heading.current) continue;
          heading.current = null;
          setCurrent(index);
        }
      },
      { root, threshold: 0.6 },
    );
    const frame = requestAnimationFrame(() => {
      for (const slide of slides.current) if (slide) observer.observe(slide);
    });
    // A finger on the track takes over from a button-driven slide.
    const release = () => {
      heading.current = null;
    };
    root.addEventListener("touchstart", release, { passive: true });
    root.addEventListener("wheel", release, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      root.removeEventListener("touchstart", release);
      root.removeEventListener("wheel", release);
    };
  }, [total]);

  // Whoever opens the storyboard needs no more nudging towards it.
  useEffect(markLearnSeen, []);

  // A link to another page of the storyboard (or the Back button) changes only the hash.
  useEffect(() => {
    const onHash = () => show(slideFromHash(window.location.hash, total));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [show, total]);

  useEffect(() => {
    window.history.replaceState(null, "", hashForSlide(current));
  }, [current]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const step = keyStep(event.key);
      if (!step) return;
      event.preventDefault();
      go(step);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  /** Taps on the page itself (not on its buttons or links) move like stories do. */
  const onTap = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("a, button")) return;
    // Measured on the track (the screen), not the page tapped: mid-slide, that page is offset.
    const box = track.current?.getBoundingClientRect();
    if (box) go(tapStep(event.clientX - box.left, box.width));
  };

  const last = current === total - 1;

  return (
    // Desktop (docs/ui-design.md §4.2b): scene and words side by side, both larger.
    <main className="mx-auto flex h-dvh max-w-md flex-col overflow-hidden lg:max-w-[1120px] lg:px-8">
      <header className="flex items-center gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 lg:pt-8">
        <ol className="flex flex-1 gap-1" aria-label={t.title}>
          {t.slides.map((slide, i) => (
            <li key={slide.title} className="flex-1">
              <button
                type="button"
                onClick={() => show(i)}
                aria-label={`${format(t.slide, { n: i + 1, total })}: ${fill(slide.title)}`}
                aria-current={i === current ? "step" : undefined}
                className={`block h-1.5 w-full rounded-full transition-colors ${
                  i <= current ? "bg-gold" : "bg-panel"
                }`}
              />
            </li>
          ))}
        </ol>
        <Link
          href={`/${locale}/rules`}
          aria-label={t.close}
          className="grid size-9 place-items-center rounded-full border-3 border-outline bg-panel text-lg font-extrabold shadow-hard-sm"
        >
          ×
        </Link>
      </header>

      <section
        ref={track}
        aria-roledescription="carousel"
        aria-label={t.title}
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {t.slides.map((slide, i) => {
          const Scene = SCENES[i];
          const active = i === current;
          return (
            <section
              key={slide.title}
              ref={(el) => {
                slides.current[i] = el;
              }}
              onClick={onTap}
              aria-roledescription="slide"
              aria-label={format(t.slide, { n: i + 1, total })}
              aria-hidden={!active}
              className="flex w-full shrink-0 snap-center flex-col items-center justify-center gap-6 px-6 lg:flex-row lg:gap-16 lg:px-12"
            >
              {/* Scenes animate only on the page in view, and again each time it comes back. */}
              <div
                key={active ? "on" : "off"}
                className={`flex h-64 w-full items-center justify-center lg:h-[min(28rem,60dvh)] lg:w-1/2 lg:flex-none ${active ? "" : "[&_*]:animate-none!"}`}
              >
                {/* Scenes are drawn for phones: on desktop they are scaled up as a whole. */}
                <div className="lg:scale-160">
                  {Scene && <Scene theme={theme} locale={locale} dict={dict} />}
                </div>
              </div>
              <div className="text-center lg:w-1/2 lg:text-left">
                <h2 className="text-game text-3xl lg:text-5xl">{fill(slide.title)}</h2>
                <p className="mt-3 text-lg leading-snug lg:mt-5 lg:text-2xl">{fill(slide.body)}</p>
              </div>
            </section>
          );
        })}
      </section>

      <footer className="flex flex-col gap-3 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] lg:mx-auto lg:w-full lg:max-w-xl lg:pb-10">
        {last ? (
          <>
            <GameButton href={`/${locale}/play/local`} variant="primary">
              {t.playBots}
            </GameButton>
            <GameButton href={`/${locale}/rules/reference`} variant="neutral">
              {t.reference}
            </GameButton>
          </>
        ) : (
          <div className="flex gap-3">
            <GameButton
              variant="neutral"
              onClick={() => go("prev")}
              disabled={current === 0}
              className="w-auto! flex-1"
            >
              {t.prev}
            </GameButton>
            <GameButton variant="primary" onClick={() => go("next")} className="w-auto! flex-[2]">
              {t.next}
            </GameButton>
          </div>
        )}
      </footer>
    </main>
  );
}
