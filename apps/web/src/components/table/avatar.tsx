import type { Role } from "@chibi-bluff/engine";
import { type ThemeManifest, themeAssetUrl } from "@chibi-bluff/themes";

/** Round avatar cropped from a character's head (docs/ui-design.md §8.2: head area 66–234 × 80–256). */
export function Avatar({
  theme,
  character,
  className = "",
}: {
  theme: ThemeManifest;
  character: Role;
  className?: string;
}) {
  const skin = theme.roles[character];
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden
      className={`block shrink-0 rounded-full border-3 border-outline ${className}`}
      style={{ background: skin.panel[1] }}
    >
      <svg x="0" y="0" width="100" height="100" viewBox="62 70 176 176" aria-hidden>
        <image href={themeAssetUrl(theme, skin.art)} x="0" y="0" width="300" height="360" />
      </svg>
    </svg>
  );
}
