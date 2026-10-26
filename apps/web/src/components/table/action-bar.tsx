"use client";

import type { ActionType } from "@chibi-bluff/engine";
import type { ThemeLocale, ThemeManifest } from "@chibi-bluff/themes";
import type { ActionButton } from "@/game/table-model";
import type { Dictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import { Avatar } from "./avatar";
import { CoupIcon, ForeignAidIcon, IncomeIcon, MaskIcon, StickerIcon } from "./icons";

const GENERAL_ICONS: Partial<Record<ActionType, typeof IncomeIcon>> = {
  income: IncomeIcon,
  foreignAid: ForeignAidIcon,
  coup: CoupIcon,
};

/** 4×2 grid: the seven actions plus stickers. Never scrolls (docs/ui-design.md §4.1). */
export function ActionBar({
  buttons,
  theme,
  locale,
  dict,
  onPick,
  onExplain,
  onSticker,
}: {
  buttons: ActionButton[];
  theme: ThemeManifest;
  locale: ThemeLocale;
  dict: Dictionary;
  onPick: (button: ActionButton) => void;
  /** Tapping a disabled action explains why. */
  onExplain: (message: string) => void;
  /** Opens the sticker picker; without it, stickers are not available here. */
  onSticker?: () => void;
}) {
  const t = dict.game;
  const currency = theme.currency[locale];
  const reasonText = (b: ActionButton) =>
    b.reason === "needCoins"
      ? format(t.table.needCoins, { cost: b.cost, currency })
      : b.reason === "mustCoup"
        ? format(t.table.mustCoup, { currency })
        : t.table.notYourTurn;

  return (
    <nav className="grid grid-cols-4 gap-2 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {buttons.map((b) => {
        const Icon = GENERAL_ICONS[b.action];
        const tint = b.claim ? theme.roles[b.claim].color : "#7d6f9c";
        return (
          <button
            key={b.action}
            type="button"
            aria-disabled={!b.enabled}
            aria-label={`${t.actions[b.action]}${b.cost ? ` −${b.cost}` : ""}${b.gain ? ` +${b.gain}` : ""}${b.enabled && b.bluff ? ` (${t.table.bluff})` : ""}`}
            onClick={() => (b.enabled ? onPick(b) : onExplain(reasonText(b)))}
            className="relative flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-2xl border-3 border-outline px-1 pt-1 pb-0.5 shadow-hard-sm transition active:translate-y-0.5 aria-disabled:opacity-40 aria-disabled:saturate-50"
            style={{
              background: `linear-gradient(${tint}, color-mix(in srgb, ${tint} 70%, #1d1230))`,
            }}
          >
            {b.claim ? (
              <Avatar theme={theme} character={b.claim} className="size-8 border-2" />
            ) : Icon ? (
              <Icon className="size-8" />
            ) : null}
            <span className="text-game-sm text-[11px] leading-none">{t.actions[b.action]}</span>
            {b.cost > 0 && (
              <span className="absolute -top-2 -left-1.5 rounded-full border-2 border-outline bg-gold px-1.5 text-[11px] font-extrabold text-outline">
                −{b.cost}
              </span>
            )}
            {b.gain > 0 && (
              <span className="absolute -top-2 -left-1.5 rounded-full border-2 border-outline bg-gain px-1.5 text-[11px] font-extrabold text-outline">
                +{b.gain}
              </span>
            )}
            {b.enabled && b.bluff && (
              <MaskIcon
                className="absolute -top-2.5 -right-2 size-6 drop-shadow-[0_2px_0_#1d1230]"
                title={t.table.bluff}
              />
            )}
          </button>
        );
      })}
      <button
        type="button"
        aria-disabled={!onSticker}
        onClick={() => (onSticker ? onSticker() : onExplain(dict.common.comingSoon))}
        className="relative flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-2xl border-3 border-outline bg-panel px-1 shadow-hard-sm aria-disabled:opacity-60"
      >
        <StickerIcon className="size-8" />
        <span className="text-game-sm text-[11px] leading-none">{t.table.sticker}</span>
      </button>
    </nav>
  );
}
