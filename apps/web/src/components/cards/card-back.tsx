// Card back: theme art plus localized text drawn on top (the exported SVG carries no text).

import { type ThemeLocale, type ThemeManifest, themeAssetUrl } from "@chibi-bluff/themes";
import { OUTLINE } from "./card-face";

export interface CardBackProps {
  theme: ThemeManifest;
  locale: ThemeLocale;
  /** Accessible name, e.g. "Face-down card". */
  label: string;
  /** Hide the text for small seats. */
  compact?: boolean;
  className?: string;
}

export function CardBack({ theme, locale, label, compact = false, className = "" }: CardBackProps) {
  return (
    <svg
      viewBox="0 0 300 450"
      role="img"
      aria-label={label}
      className={`block font-sans ${className}`}
    >
      <image href={themeAssetUrl(theme, theme.cardBack)} x="0" y="0" width="300" height="450" />
      {!compact && (
        <>
          <text
            x="150"
            y="221"
            textAnchor="middle"
            fontWeight="800"
            fontSize="30"
            fill="#fff"
            stroke={OUTLINE}
            strokeWidth="5"
            paintOrder="stroke"
          >
            BLUFF
          </text>
          <text
            x="150"
            y="364"
            textAnchor="middle"
            fontWeight="800"
            fontSize="24"
            fill="#fff"
            stroke={OUTLINE}
            strokeWidth="5"
            paintOrder="stroke"
          >
            {theme.cardBackLabel[locale]}
          </text>
        </>
      )}
    </svg>
  );
}
