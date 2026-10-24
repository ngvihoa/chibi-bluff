import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

export default async function NotFound() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-game text-4xl">{dict.notFound.title}</h1>
      <p className="text-muted">{dict.notFound.body}</p>
      <Link href={`/${locale}`} className="font-bold text-gold underline underline-offset-4">
        {dict.notFound.home}
      </Link>
    </main>
  );
}
