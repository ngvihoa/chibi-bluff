import type { Metadata, Viewport } from "next";
import { Baloo_2 } from "next/font/google";
import { LEARN_HINT_SCRIPT } from "@/components/rules/learn-hint-key";
import { I18nProvider } from "@/i18n/client";
import { LOCALES } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import "../globals.css";

const baloo = Baloo_2({
  subsets: ["latin", "vietnamese"],
  weight: ["500", "700", "800"],
  variable: "--font-baloo",
});

export async function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.meta.title, description: dict.meta.description };
}

export const viewport: Viewport = {
  themeColor: "#1c1a36",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  return (
    // The head script may mark <html> before React hydrates it.
    <html lang={locale} className={baloo.variable} suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed string of our own, see learn-hint-key.ts */}
        <script dangerouslySetInnerHTML={{ __html: LEARN_HINT_SCRIPT }} />
      </head>
      <body>
        <I18nProvider locale={locale} dict={dict}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
