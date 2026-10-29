import { ROLES } from "@chibi-bluff/engine";
import { getTheme } from "@chibi-bluff/themes";
import Link from "next/link";
import { Avatar } from "@/components/table/avatar";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";

const LIST_SECTIONS = ["overview", "actions", "challenge", "block", "influence", "timers"] as const;
const ORDER = [
  "overview",
  "characters",
  "actions",
  "challenge",
  "block",
  "influence",
  "timers",
  "faq",
] as const;

/** Rules reference (docs/ui-design.md §10.3). Every sentence follows docs/game-rules.md. */
export default async function ReferencePage() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const t = dict.rules.reference;
  const theme = getTheme();
  const fill = (text: string) =>
    format(text, {
      ...Object.fromEntries(ROLES.map((role) => [role, theme.roles[role].name[locale]])),
      currency: theme.currency[locale],
    });

  const list = (key: (typeof LIST_SECTIONS)[number]) => (
    <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-gold">
      {t.sections[key].items.map((item) => (
        <li key={item}>{fill(item)}</li>
      ))}
    </ul>
  );

  const bodies: Record<(typeof ORDER)[number], React.ReactNode> = {
    overview: list("overview"),
    characters: (
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
    ),
    actions: list("actions"),
    challenge: list("challenge"),
    block: list("block"),
    influence: list("influence"),
    timers: list("timers"),
    faq: (
      <dl className="flex flex-col gap-4">
        {t.sections.faq.items.map(({ q, a }) => (
          <div key={q}>
            <dt className="font-extrabold">{fill(q)}</dt>
            <dd className="mt-1 text-muted">{fill(a)}</dd>
          </div>
        ))}
      </dl>
    ),
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-3">
        <Link
          href={`/${locale}/rules`}
          className="font-bold text-gold underline underline-offset-4"
        >
          {dict.common.back}
        </Link>
        <h1 className="text-game text-3xl">{t.title}</h1>
      </div>

      <nav
        aria-label={t.toc}
        className="sticky top-0 z-10 -mx-4 overflow-x-auto bg-bg/95 px-4 py-2 backdrop-blur-sm [scrollbar-width:none]"
      >
        <ul className="flex gap-2 whitespace-nowrap">
          {ORDER.map((key) => (
            <li key={key}>
              <a
                href={`#${key}`}
                className="block rounded-full border-2 border-outline bg-panel px-3 py-1 text-sm font-extrabold"
              >
                {t.sections[key].title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {ORDER.map((key) => (
        <section
          key={key}
          id={key}
          aria-labelledby={`${key}-title`}
          className="scroll-mt-16 rounded-3xl border-3 border-outline bg-panel p-4 shadow-hard-sm"
        >
          <h2 id={`${key}-title`} className="text-game-sm mb-3 text-xl">
            {t.sections[key].title}
          </h2>
          {bodies[key]}
        </section>
      ))}

      <Link
        href={`/${locale}/rules/learn`}
        className="text-center font-bold text-gold underline underline-offset-4"
      >
        {dict.rules.parts.learn.title}
      </Link>
    </main>
  );
}
