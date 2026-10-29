import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

/** /rules: the three ways in (docs/ui-design.md §10). */
export default async function RulesPage() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const t = dict.rules;
  const parts = [
    { key: "learn", href: `/${locale}/rules/learn`, ...t.parts.learn, primary: true },
    { key: "reference", href: `/${locale}/rules/reference`, ...t.parts.reference, primary: false },
  ] as const;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 py-6">
      <div className="flex items-center gap-3">
        <Link href={`/${locale}`} className="font-bold text-gold underline underline-offset-4">
          {dict.common.back}
        </Link>
        <h1 className="text-game text-3xl">{t.title}</h1>
      </div>
      <p className="text-muted">{t.hubIntro}</p>
      {parts.map((part) => (
        <Link
          key={part.key}
          href={part.href}
          className={`flex flex-col gap-1 rounded-3xl border-3 border-outline p-5 shadow-hard transition active:translate-y-1 active:shadow-hard-pressed ${
            part.primary ? "bg-linear-to-b from-[#ff6b5a] to-danger" : "bg-panel"
          }`}
        >
          <span className="text-game text-2xl">{part.title}</span>
          <span className="text-sm font-bold">{part.hint}</span>
        </Link>
      ))}
      <div
        aria-disabled
        className="flex flex-col gap-1 rounded-3xl border-3 border-outline bg-panel p-5 opacity-60"
      >
        <span className="text-game text-2xl">{t.parts.tips.title}</span>
        <span className="text-sm font-bold">{t.parts.tips.hint}</span>
      </div>
    </main>
  );
}
