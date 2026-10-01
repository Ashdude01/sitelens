import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BlankLinks } from "@/components/blank-links";
import { config } from "@/server/config";
import { notFound } from "next/navigation";
import { isLocale, LOCALE_CODES, localeMeta } from "@/i18n/locales";
import "../globals.css";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (isLocale(locale)) setRequestLocale(locale);
  const t = await getTranslations("meta");
  return {
    metadataBase: new URL(config.publicUrl),
    title: {
      default: t("title", { site: config.siteName }),
      template: `%s | ${config.siteName}`,
    },
    description: t("description"),
  };
}

export function generateStaticParams() {
  return LOCALE_CODES.map((locale) => ({ locale }));
}

export default async function RootLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  return (
    <html lang={localeMeta(locale).intl} dir={locale === "ar" ? "rtl" : "ltr"} suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <TooltipProvider>
              <BlankLinks />
              {children}
            </TooltipProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
