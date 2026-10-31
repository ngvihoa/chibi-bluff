import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

/** /rules: the three ways in (docs/ui-design.md §10). */
export default async function RulesPage() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const t = dict.rules;
  const parts = [
    { key: "learn", href: `/${locale}/rules/learn`, ...t.parts.learn, primary: true },
    { key: "reference", href: `/${locale}/rules/reference`, ...t.parts.reference, primary: false },
    { key: "tips", href: `/${locale}/rules/tips`, ...t.parts.tips, primary: false },
  ] as const;

  return (
    // Desktop (docs/ui-design.md §4.2b): the three ways in on one row.
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 py-6 lg:max-w-[1120px] lg:gap-8 lg:px-8 lg:pt-10">
      <div className="flex items-center gap-3">
        <Link href={`/${locale}`} className="font-bold text-gold underline underline-offset-4">
          {dict.common.back}
        </Link>
        <h1 className="text-game text-3xl lg:text-5xl">{t.title}</h1>
      </div>
      <p className="text-muted lg:text-lg">{t.hubIntro}</p>
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-3 lg:gap-6">
        {parts.map((part) => (
          <Link
            key={part.key}
            href={part.href}
            className={`flex flex-col gap-1 rounded-3xl border-3 border-outline p-5 shadow-hard transition active:translate-y-1 active:shadow-hard-pressed lg:min-h-48 lg:justify-end lg:gap-2 lg:p-8 lg:hover:-translate-y-1 ${
              part.primary ? "bg-linear-to-b from-[#ff6b5a] to-danger" : "bg-panel"
            }`}
          >
            <span className="text-game text-2xl lg:text-3xl">{part.title}</span>
            <span className="text-sm font-bold lg:text-base">{part.hint}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
