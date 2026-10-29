// One section of the rules reference (docs/ui-design.md §10.3). No hooks: the reference page
// renders it on the server, and the in-game quick-rules sheet renders it in the browser.

import { ROLES } from "@chibi-bluff/engine";
import type { ThemeLocale, ThemeManifest } from "@chibi-bluff/themes";
import { Avatar } from "@/components/table/avatar";
import type { Dictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";

/** Sections in reading order; each is also the anchor on /rules/reference. */
export const REFERENCE_SECTIONS = [
  "overview",
  "characters",
  "actions",
  "challenge",
  "block",
  "influence",
  "timers",
  "faq",
] as const;
export type ReferenceSectionId = (typeof REFERENCE_SECTIONS)[number];

type ListSection = Exclude<ReferenceSectionId, "characters" | "faq">;

/** Fills the theme's character names and currency into a rules sentence. */
export function rulesText(theme: ThemeManifest, locale: ThemeLocale) {
  const values = {
    ...Object.fromEntries(ROLES.map((role) => [role, theme.roles[role].name[locale]])),
    currency: theme.currency[locale],
  };
  return (text: string) => format(text, values);
}

export function ReferenceSection({
  id,
  dict,
  theme,
  locale,
}: {
  id: ReferenceSectionId;
  dict: Dictionary;
  theme: ThemeManifest;
  locale: ThemeLocale;
}) {
  const t = dict.rules.reference;
  const fill = rulesText(theme, locale);

  if (id === "characters") {
    return (
      <table className="w-full border-separate border-spacing-y-2 text-left text-sm">
        <thead className="text-xs text-muted">
          <tr>
            <th scope="col">{t.columns.character}</th>
            <th scope="col">{t.columns.action}</th>
            <th scope="col">{t.columns.blocks}</th>
          </tr>
        </thead>
        <tbody>
          {ROLES.map((role) => {
            const row = t.sections.characters.rows[role];
            return (
              <tr key={role} className="align-top">
                <th scope="row" className="pr-2 font-extrabold">
                  <span className="flex items-center gap-2">
                    <Avatar theme={theme} character={role} className="size-9 border-2" />
                    {theme.roles[role].name[locale]}
                  </span>
                </th>
                <td className="pr-2">{fill(row.action)}</td>
                <td>{fill(row.blocks)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  if (id === "faq") {
    return (
      <dl className="flex flex-col gap-4">
        {t.sections.faq.items.map(({ q, a }) => (
          <div key={q}>
            <dt className="font-extrabold">{fill(q)}</dt>
            <dd className="mt-1 text-muted">{fill(a)}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-gold">
      {t.sections[id as ListSection].items.map((item) => (
        <li key={item}>{fill(item)}</li>
      ))}
    </ul>
  );
}
