import { getTheme } from "@chibi-bluff/themes";
import Link from "next/link";
import { REFERENCE_SECTIONS, ReferenceSection } from "@/components/rules/reference-section";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

/** Rules reference (docs/ui-design.md §10.3). Every sentence follows docs/game-rules.md. */
export default async function ReferencePage() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const t = dict.rules.reference;
  const theme = getTheme();

  return (
    // Desktop (docs/ui-design.md §4.2b): contents stick on the left, sections read on the right.
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] lg:grid lg:max-w-[1120px] lg:grid-cols-[220px_minmax(0,760px)] lg:content-start lg:justify-center lg:gap-x-12 lg:gap-y-6 lg:px-8 lg:pt-10">
      <div className="flex items-center gap-3 lg:col-span-2">
        <Link
          href={`/${locale}/rules`}
          className="font-bold text-gold underline underline-offset-4"
        >
          {dict.common.back}
        </Link>
        <h1 className="text-game text-3xl lg:text-5xl">{t.title}</h1>
      </div>

      <nav
        aria-label={t.toc}
        className="sticky top-0 z-10 -mx-4 overflow-x-auto bg-bg/95 px-4 py-2 backdrop-blur-sm [scrollbar-width:none] lg:top-8 lg:mx-0 lg:self-start lg:overflow-visible lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
      >
        <ul className="flex w-max gap-2 whitespace-nowrap lg:w-auto lg:flex-col lg:whitespace-normal">
          {REFERENCE_SECTIONS.map((key) => (
            <li key={key}>
              <a
                href={`#${key}`}
                className="block rounded-full border-2 border-outline bg-panel px-3 py-1 text-sm font-extrabold lg:rounded-xl lg:px-4 lg:py-2 lg:text-base lg:hover:bg-outline"
              >
                {t.sections[key].title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="contents lg:flex lg:flex-col lg:gap-6">
        {REFERENCE_SECTIONS.map((key) => (
          <section
            key={key}
            id={key}
            aria-labelledby={`${key}-title`}
            className="scroll-mt-16 rounded-3xl border-3 border-outline bg-panel p-4 shadow-hard-sm lg:scroll-mt-8 lg:p-6 lg:text-lg"
          >
            <h2 id={`${key}-title`} className="text-game-sm mb-3 text-xl lg:text-2xl">
              {t.sections[key].title}
            </h2>
            <ReferenceSection id={key} dict={dict} theme={theme} locale={locale} />
          </section>
        ))}

        <Link
          href={`/${locale}/rules/learn`}
          className="text-center font-bold text-gold underline underline-offset-4"
        >
          {dict.rules.parts.learn.title}
        </Link>
      </div>
    </main>
  );
}
