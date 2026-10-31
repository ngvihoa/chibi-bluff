import { getTheme } from "@chibi-bluff/themes";
import Link from "next/link";
import { rulesText } from "@/components/rules/reference-section";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

const BEGINNER = 5;

/** Strategy tips (docs/ui-design.md §10.4). Rule-related tips link to the reference. */
export default async function TipsPage() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const t = dict.rules.tips;
  const fill = rulesText(getTheme(), locale);
  const groups = [
    { title: t.beginner, items: t.items.slice(0, BEGINNER), start: 1 },
    { title: t.advanced, items: t.items.slice(BEGINNER), start: BEGINNER + 1 },
  ];

  return (
    // Desktop (docs/ui-design.md §4.2b): beginner and advanced tips side by side.
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] lg:max-w-[1120px] lg:gap-6 lg:px-8 lg:pt-10">
      <div className="flex items-center gap-3">
        <Link
          href={`/${locale}/rules`}
          className="font-bold text-gold underline underline-offset-4"
        >
          {dict.common.back}
        </Link>
        <h1 className="text-game text-3xl lg:text-5xl">{t.title}</h1>
      </div>
      <p className="text-muted lg:text-lg">{t.intro}</p>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
        {groups.map((group) => (
          <section key={group.title} className="flex flex-col gap-3">
            <h2 className="text-game-sm text-xl lg:text-2xl">{group.title}</h2>
            <ol className="flex flex-col gap-3">
              {group.items.map((tip, i) => (
                <li
                  key={tip.title}
                  className="rounded-3xl border-3 border-outline bg-panel p-4 shadow-hard-sm"
                >
                  <h3 className="flex items-baseline gap-2 text-lg font-extrabold">
                    <span className="text-gold">{group.start + i}.</span>
                    {fill(tip.title)}
                  </h3>
                  <p className="mt-1">{fill(tip.body)}</p>
                  <p className="mt-2 rounded-2xl bg-bg/60 px-3 py-2 text-sm text-muted">
                    <span className="font-extrabold text-ink">{t.example}: </span>
                    {fill(tip.example)}
                  </p>
                  {tip.rule && (
                    <Link
                      href={`/${locale}/rules/reference#${tip.rule}`}
                      className="mt-2 inline-block text-sm font-bold text-gold underline underline-offset-4"
                    >
                      {t.seeRule}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </main>
  );
}
