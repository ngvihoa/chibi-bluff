"use client";

// Overlays for the table's big moments (docs/ui-design.md §5).

import type { Role } from "@chibi-bluff/engine";
import type { ThemeLocale, ThemeManifest } from "@chibi-bluff/themes";
import { CardFace } from "@/components/cards/card-face";
import type { CoinFloat, Moment } from "@/game/use-moments";
import type { Dictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import { Avatar } from "./avatar";

/**
 * Challenge: the table dims and goes quiet (400ms), the claimed card flips in (600ms),
 * then the verdict stamp lands: red "Busted!" or gold "The real deal!".
 */
export function MomentOverlay({
  moment,
  theme,
  locale,
  dict,
  name,
  player,
  onSkip,
}: {
  moment: Moment;
  theme: ThemeManifest;
  locale: ThemeLocale;
  dict: Dictionary;
  name: (id: string) => string;
  /** The player's avatar and the cards they have lost, for the elimination moment. */
  player: (id: string) => { avatar: Role; lost: Role[] } | undefined;
  onSkip: () => void;
}) {
  const t = dict.game.moment;
  return (
    <button
      type="button"
      onClick={onSkip}
      aria-live="assertive"
      // Desktop: covers the table column only, so it centres on the table, not the screen.
      className="fixed inset-0 z-40 flex lg:absolute lg:rounded-3xl animate-[fade-in_250ms_ease-out] flex-col items-center justify-center gap-4 bg-outline/85 p-6 backdrop-blur-[2px]"
    >
      {moment.kind === "challenge" ? (
        <>
          <p className="text-game text-2xl">
            {format(t.challenged, {
              challenger: name(moment.challengerId),
              claimant: name(moment.claimantId),
            })}
          </p>
          <ChallengeCard
            role={moment.role}
            truthful={moment.truthful}
            theme={theme}
            locale={locale}
            ability={format(dict.cards.abilities[moment.role], {
              currency: theme.currency[locale],
            })}
            labels={{ lost: dict.cards.lost, owned: dict.cards.yours }}
          />
          <Stamp tone={moment.truthful ? "gold" : "red"}>
            {moment.truthful ? t.truthful : t.caught}
          </Stamp>
          <p className="text-sm font-bold text-ink">
            {format(moment.truthful ? t.truthfulDetail : t.caughtDetail, {
              claimant: name(moment.claimantId),
              role: theme.roles[moment.role].name[locale],
            })}
          </p>
        </>
      ) : (
        <Eliminated
          info={player(moment.playerId)}
          theme={theme}
          locale={locale}
          title={format(t.eliminated, { player: name(moment.playerId) })}
          stamp={t.out}
          labels={{ lost: dict.cards.lost, owned: dict.cards.yours }}
        />
      )}
    </button>
  );
}

/** The player's chibi greys out, their two lost cards fan out below and the stamp lands. */
function Eliminated({
  info,
  theme,
  locale,
  title,
  stamp,
  labels,
}: {
  info: { avatar: Role; lost: Role[] } | undefined;
  theme: ThemeManifest;
  locale: ThemeLocale;
  title: string;
  stamp: string;
  labels: { lost: string; owned: string };
}) {
  return (
    <>
      {info && (
        <Avatar
          theme={theme}
          character={info.avatar}
          className="size-28 animate-[pop-in_350ms_cubic-bezier(.3,1.6,.6,1)] grayscale lg:size-36"
        />
      )}
      <p className="text-game animate-[pop-in_350ms_cubic-bezier(.3,1.6,.6,1)] text-center text-4xl">
        {title}
      </p>
      {info && info.lost.length > 0 && (
        <div className="flex animate-[flip-in_400ms_ease-out_150ms_both] gap-3 [perspective:800px]">
          {info.lost.map((role, i) => (
            <CardFace
              // biome-ignore lint/suspicious/noArrayIndexKey: two lost cards may share a role
              key={i}
              theme={theme}
              character={role}
              locale={locale}
              ability=""
              compact
              lost
              labels={labels}
              className={`w-20 shrink-0 lg:w-28 ${i % 2 ? "rotate-6" : "-rotate-6"}`}
            />
          ))}
        </div>
      )}
      <Stamp tone="red" delay={600}>
        {stamp}
      </Stamp>
    </>
  );
}

function ChallengeCard({
  role,
  truthful,
  theme,
  locale,
  ability,
  labels,
}: {
  role: Role;
  truthful: boolean;
  theme: ThemeManifest;
  locale: ThemeLocale;
  ability: string;
  labels: { lost: string; owned: string };
}) {
  return (
    <div className="animate-[flip-in_600ms_ease-out_400ms_both] [perspective:800px]">
      <CardFace
        theme={theme}
        character={role}
        locale={locale}
        ability={ability}
        labels={labels}
        lost={!truthful}
        className={`w-40 ${truthful ? "drop-shadow-[0_0_24px_#ffd23f]" : ""}`}
      />
    </div>
  );
}

function Stamp({
  tone,
  delay = 1000,
  children,
}: {
  tone: "red" | "gold";
  /** When the stamp lands, in ms after the overlay opens. */
  delay?: number;
  children: React.ReactNode;
}) {
  const colors =
    tone === "red" ? "border-danger text-danger bg-white/90" : "border-gold text-outline bg-gold";
  return (
    <span
      className={`-mt-16 rotate-[-12deg] animate-[stamp_350ms_cubic-bezier(.3,1.6,.6,1)_both] rounded-xl border-4 px-4 py-1 text-3xl font-extrabold uppercase tracking-wide shadow-hard ${colors}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </span>
  );
}

/** "+3" / "−2" rising from a seat when its coins change. */
export function CoinFloats({ floats, playerId }: { floats: CoinFloat[]; playerId: string }) {
  const mine = floats.filter((f) => f.playerId === playerId);
  if (mine.length === 0) return null;
  return (
    <span aria-hidden className="pointer-events-none absolute inset-x-0 -top-1 flex justify-center">
      {mine.map((f) => (
        <span
          key={f.id}
          className={`text-game-sm absolute animate-[float-up_1.2s_ease-out_both] text-lg ${
            f.delta > 0 ? "text-gold" : "text-danger"
          }`}
        >
          {f.delta > 0 ? `+${f.delta}` : `−${-f.delta}`}
        </span>
      ))}
    </span>
  );
}

/** Confetti in the characters' colours for the game-over screen. */
export function Confetti({ theme }: { theme: ThemeManifest }) {
  const colors = Object.values(theme.roles).map((r) => r.color);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      {Array.from({ length: 36 }, (_, i) => {
        const left = (i * 37) % 100;
        const delay = (i % 9) * 0.12;
        const duration = 1.6 + (i % 5) * 0.25;
        return (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: static decorative pieces
            key={i}
            className="absolute -top-4 block h-3 w-2 animate-[confetti_var(--d)_ease-in_var(--delay)_both] rounded-sm"
            style={
              {
                left: `${left}%`,
                background: colors[i % colors.length],
                "--d": `${duration}s`,
                "--delay": `${delay}s`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
