import Image from "next/image";
import { GameButton } from "@/components/game-button";
import { LanguageSwitch } from "@/components/language-switch";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

/** Menu buttons grow on desktop, where the menu has a whole column to itself. */
const BIG = "lg:min-h-20 lg:text-2xl";

export default async function Home() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const t = dict.home;

  return (
    // Desktop (docs/ui-design.md §4.2b): banner and menu side by side.
    <div className="mx-auto flex min-h-dvh max-w-md flex-col pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:max-w-[1120px] lg:px-8 lg:pt-8">
      <div className="flex flex-1 flex-col lg:flex-row lg:items-center lg:gap-12">
        <header className="relative h-72 overflow-hidden border-b-4 border-outline sm:h-80 lg:h-[min(72dvh,600px)] lg:flex-[1.4] lg:rounded-[2rem] lg:border-4 lg:shadow-hard">
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
            <h1 className="text-game text-5xl leading-none tracking-wide sm:text-6xl lg:text-8xl">
              Chibi Bluff
            </h1>
            <p className="text-game-sm mt-2 text-xl lg:mt-4 lg:text-3xl">
              {dict.meta.title.split(": ")[1]}
            </p>
            <p className="text-game-sm mt-1 text-base lg:mt-2 lg:text-xl">{t.tagline}</p>
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-5 px-4 pt-8 lg:justify-center lg:gap-6 lg:px-0 lg:pt-0">
          <GameButton href={`/${locale}/play/local`} variant="primary" className={BIG}>
            <span className="flex flex-col items-center leading-tight">
              <span>{t.playBots}</span>
              <span className="text-sm font-bold [-webkit-text-stroke:3px_var(--color-outline)] lg:text-base">
                {t.playBotsHint}
              </span>
            </span>
          </GameButton>
          <GameButton href={`/${locale}/online`} variant="gold" className={BIG}>
            <span className="flex flex-col items-center leading-tight">
              <span>{t.playOnline}</span>
              <span className="text-sm font-bold lg:text-base">{t.playOnlineHint}</span>
            </span>
          </GameButton>
          <GameButton href={`/${locale}/rules`} variant="neutral" className={BIG}>
            {t.rules}
          </GameButton>
        </main>
      </div>

      <footer className="px-4 pt-8 text-center text-xs text-muted">{t.credit}</footer>
    </div>
  );
}
