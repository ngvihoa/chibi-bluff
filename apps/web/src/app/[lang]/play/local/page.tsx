import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

// Placeholder until the local game lands (checkpoint 8).
export default async function LocalGamePage() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-game text-4xl">{dict.play.localTitle}</h1>
      <p className="text-muted">{dict.play.localSoon}</p>
      <Link href={`/${locale}`} className="font-bold text-gold underline underline-offset-4">
        {dict.common.back}
      </Link>
    </main>
  );
}
