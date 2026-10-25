import type { PlayerView } from "@chibi-bluff/engine";
import type { ThemeLocale, ThemeManifest } from "@chibi-bluff/themes";
import { CardFace } from "@/components/cards/card-face";
import type { stageClaim } from "@/game/table-model";
import type { Dictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";

/**
 * Centre of the table: who is doing what, with the claimed character shown big
 * (docs/ui-design.md §4.1). The response timer lives in the bottom sheet.
 */
export function Stage({
  view,
  claim,
  headline,
  detail,
  theme,
  locale,
  dict,
  name,
  recap,
}: {
  view: PlayerView;
  claim: ReturnType<typeof stageClaim>;
  headline: string;
  detail: string | null;
  theme: ThemeManifest;
  locale: ThemeLocale;
  dict: Dictionary;
  name: (id: string) => string;
  /** What happened in the turn that just ended; shown instead of the headline while it lasts. */
  recap: string[] | null;
}) {
  if (recap && recap.length > 0) {
    return (
      <section className="flex min-h-28 flex-col justify-center rounded-3xl border-3 border-gold bg-[radial-gradient(circle_at_30%_40%,#3a3470,#2a2750)] p-3 shadow-[0_0_14px_#ffd23f80]">
        <p className="text-xs font-bold text-gold">{dict.game.table.justNow}</p>
        <ul aria-live="polite" className="mt-1 flex flex-col gap-0.5">
          {recap.map((line, i) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed lines of one recap
              key={i}
              className={`animate-[pop-in_300ms_cubic-bezier(.3,1.6,.6,1)_both] font-extrabold leading-snug ${
                i === recap.length - 1 ? "text-lg" : "text-sm text-muted"
              }`}
              style={{ animationDelay: `${i * 120}ms` }}
            >
              {line}
            </li>
          ))}
        </ul>
      </section>
    );
  }
  const blocking = view.phase.kind === "AWAIT_BLOCK_RESPONSE";
  const label =
    view.phase.kind === "AWAIT_REPLACEMENT"
      ? dict.game.table.proved
      : blocking
        ? dict.game.table.blocks
        : dict.game.table.declares;
  return (
    <section className="flex min-h-28 items-center gap-3 rounded-3xl border-3 border-outline bg-[radial-gradient(circle_at_30%_40%,#3a3470,#2a2750)] p-3 shadow-hard-sm">
      {claim ? (
        <CardFace
          key={`${view.phaseId}-${claim.role}`}
          theme={theme}
          character={claim.role}
          locale={locale}
          ability=""
          compact
          labels={{ lost: dict.cards.lost, owned: dict.cards.yours }}
          className="w-16 shrink-0 animate-[pop-in_300ms_cubic-bezier(.3,1.6,.6,1)]"
        />
      ) : null}
      <div className="min-w-0 flex-1" aria-live="polite">
        {claim && (
          <p className="text-xs font-bold text-muted">
            {format(label, { player: name(claim.playerId) })}
          </p>
        )}
        {claim && (
          <p
            className="text-game-sm truncate text-xl leading-tight"
            style={{ color: theme.roles[claim.role].panel[0] }}
          >
            {theme.roles[claim.role].name[locale]}
          </p>
        )}
        <p className={`font-extrabold leading-snug ${claim ? "mt-0.5 text-sm" : "text-lg"}`}>
          {headline}
        </p>
        {detail && <p className="mt-0.5 text-xs text-muted">{detail}</p>}
      </div>
    </section>
  );
}
