import Image from "next/image";
import { GameButton } from "@/components/game-button";
import { LanguageSwitch } from "@/components/language-switch";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

export default async function Home() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const t = dict.home;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="relative h-72 overflow-hidden border-b-4 border-outline sm:h-80">
        <Image
          src="/themes/giang-ho/background.svg"
          alt=""
          fill
          priority
          unoptimized
          className="object-cover"
        />
        <div className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4">
          <LanguageSwitch />
        </div>
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-4 text-center">
          <h1 className="text-game text-5xl leading-none tracking-wide sm:text-6xl">Chibi Bluff</h1>
          <p className="text-game-sm mt-2 text-xl">{dict.meta.title.split(": ")[1]}</p>
          <p className="text-game-sm mt-1 text-base">{t.tagline}</p>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-5 px-4 pt-8">
        <GameButton href={`/${locale}/play/local`} variant="primary">
          <span className="flex flex-col items-center leading-tight">
            <span>{t.playBots}</span>
            <span className="text-sm font-bold [-webkit-text-stroke:3px_var(--color-outline)]">
              {t.playBotsHint}
            </span>
          </span>
        </GameButton>
        <GameButton variant="gold" disabled badge={dict.common.comingSoon}>
          {t.createRoom}
        </GameButton>
        <GameButton variant="neutral" disabled badge={dict.common.comingSoon}>
          {t.joinRoom}
        </GameButton>
      </main>

      <footer className="px-4 pt-8 text-center text-xs text-muted">{t.credit}</footer>
    </div>
  );
}
