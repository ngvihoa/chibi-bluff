import type { ThemeLocale, ThemeManifest } from "@chibi-bluff/themes";
import { CardBack } from "@/components/cards/card-back";

/**
 * The face-down court deck. Its size never changes during a game (cards drawn are always
 * returned), but it gives flying cards somewhere to come from and go to.
 * `data-deck-pile` is the anchor FlyLayer animates from/to.
 */
export function DeckPile({
  theme,
  locale,
  count,
  label,
}: {
  theme: ThemeManifest;
  locale: ThemeLocale;
  count: number;
  label: string;
}) {
  const layers = Math.min(3, count);
  return (
    <div data-deck-pile role="img" aria-label={label} className="relative h-15 w-11 shrink-0">
      {Array.from({ length: layers }, (_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: decorative stack layers
          key={i}
          aria-hidden
          className="absolute drop-shadow-[0_2px_0_#1d1230]"
          style={{ left: i * 2, top: 4 - i * 2 }}
        >
          <CardBack theme={theme} locale={locale} label="" compact className="w-9" />
        </div>
      ))}
      <span className="absolute -right-1 -bottom-1 rounded-full border-2 border-outline bg-gold px-1.5 text-xs font-extrabold text-outline">
        {count}
      </span>
    </div>
  );
}
