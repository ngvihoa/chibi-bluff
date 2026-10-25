import { ROLES, type Role, RULES } from "@chibi-bluff/engine";
import type { ThemeLocale, ThemeManifest } from "@chibi-bluff/themes";
import { Avatar } from "./avatar";

/**
 * "Cards out": how many copies of each character are face up (docs/ui-design.md §5b).
 * Public information gathered in one place so new players can count cards like the bots do.
 */
export function RevealedTally({
  counts,
  theme,
  locale,
  label,
}: {
  counts: Record<Role, number>;
  theme: ThemeManifest;
  locale: ThemeLocale;
  label: string;
}) {
  return (
    <section aria-label={label} className="flex items-center justify-between gap-1 px-3 pt-2">
      {ROLES.map((role) => {
        const out = counts[role];
        const gone = out >= RULES.CARDS_PER_ROLE;
        return (
          <div
            key={role}
            role="img"
            title={theme.roles[role].name[locale]}
            aria-label={`${theme.roles[role].name[locale]}: ${out}/${RULES.CARDS_PER_ROLE}`}
            className={`flex items-center gap-1 rounded-full border-2 border-outline bg-panel py-0.5 pr-2 pl-0.5 ${
              gone ? "opacity-50 grayscale" : ""
            }`}
          >
            <Avatar theme={theme} character={role} className="size-6 border-2" />
            <span
              className={`text-xs font-extrabold tabular-nums ${out > 0 ? "text-gold" : "text-muted"}`}
            >
              {out}/{RULES.CARDS_PER_ROLE}
            </span>
          </div>
        );
      })}
    </section>
  );
}
