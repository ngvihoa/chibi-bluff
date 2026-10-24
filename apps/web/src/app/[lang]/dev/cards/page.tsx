import { ROLES } from "@chibi-bluff/engine";
import { getTheme } from "@chibi-bluff/themes";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { CardBack } from "@/components/cards/card-back";
import { CardFace } from "@/components/cards/card-face";
import { LanguageSwitch } from "@/components/language-switch";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";

// Developer gallery of every card state, for visual review. Not shipped in production.
export default async function CardGallery() {
  if (process.env.NODE_ENV === "production") notFound();
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const theme = getTheme();
  const ability = (role: (typeof ROLES)[number]) =>
    format(dict.cards.abilities[role], { currency: theme.currency[locale] });
  const labels = { lost: dict.cards.lost, owned: dict.cards.yours };

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-game text-3xl">Card gallery · {theme.name[locale]}</h1>
        <LanguageSwitch />
      </div>

      <Section title="Characters">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {ROLES.map((role) => (
            <CardFace
              key={role}
              theme={theme}
              character={role}
              locale={locale}
              ability={ability(role)}
              labels={labels}
            />
          ))}
        </div>
      </Section>

      <Section title="States">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Labelled caption="normal">
            <CardFace
              theme={theme}
              character="duke"
              locale={locale}
              ability={ability("duke")}
              labels={labels}
            />
          </Labelled>
          <Labelled caption="owned (face-down, yours)">
            <CardFace
              theme={theme}
              character="duke"
              locale={locale}
              ability={ability("duke")}
              owned
              labels={labels}
            />
          </Labelled>
          <Labelled caption="selected">
            <CardFace
              theme={theme}
              character="duke"
              locale={locale}
              ability={ability("duke")}
              selected
              labels={labels}
            />
          </Labelled>
          <Labelled caption="lost (face up)">
            <CardFace
              theme={theme}
              character="duke"
              locale={locale}
              ability={ability("duke")}
              lost
              labels={labels}
            />
          </Labelled>
        </div>
      </Section>

      <Section title="Card back">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Labelled caption="full">
            <CardBack theme={theme} locale={locale} label={dict.cards.back} />
          </Labelled>
        </div>
      </Section>

      <Section title="Compact (opponent seats)">
        <div className="flex flex-wrap items-end gap-6">
          <Labelled caption="back + back">
            <div className="flex gap-1.5">
              <CardBack
                theme={theme}
                locale={locale}
                label={dict.cards.back}
                compact
                className="w-12"
              />
              <CardBack
                theme={theme}
                locale={locale}
                label={dict.cards.back}
                compact
                className="w-12"
              />
            </div>
          </Labelled>
          <Labelled caption="back + lost">
            <div className="flex gap-1.5">
              <CardBack
                theme={theme}
                locale={locale}
                label={dict.cards.back}
                compact
                className="w-12"
              />
              <CardFace
                theme={theme}
                character="captain"
                locale={locale}
                ability=""
                compact
                lost
                labels={labels}
                className="w-12"
              />
            </div>
          </Labelled>
          {ROLES.map((role) => (
            <Labelled key={role} caption={role}>
              <CardFace
                theme={theme}
                character={role}
                locale={locale}
                ability=""
                compact
                labels={labels}
                className="w-12"
              />
            </Labelled>
          ))}
        </div>
      </Section>

      <Section title="My hand (mobile size)">
        <div className="flex items-end gap-3">
          <CardFace
            theme={theme}
            character="duke"
            locale={locale}
            ability={ability("duke")}
            owned
            labels={labels}
            className="w-36 -rotate-3"
          />
          <CardFace
            theme={theme}
            character="contessa"
            locale={locale}
            ability={ability("contessa")}
            owned
            labels={labels}
            className="w-36 rotate-3"
          />
        </div>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-game-sm mb-4 text-xl">{title}</h2>
      {children}
    </section>
  );
}

function Labelled({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <figure className="flex flex-col items-center gap-2">
      {children}
      <figcaption className="text-xs text-muted">{caption}</figcaption>
    </figure>
  );
}
