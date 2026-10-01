import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { pageAlternates } from "@/i18n/alternates";
import { isLocale } from "@/i18n/locales";
import { config } from "@/server/config";
import { BadgeCheck, Gauge, Layers, ShieldCheck } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { SearchForm } from "@/components/search-form";
import { SiteDirectory } from "@/components/site-directory";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadFingerprints } from "@/server/scanner/fingerprints";
import { fmt } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations("meta");
  return {
    title: { absolute: t("title", { site: config.siteName }) },
    description: t("description"),
    alternates: pageAlternates("/", locale),
  };
}

export const revalidate = 3600;

export default async function HomePage() {
  const fp = loadFingerprints();
  const t = await getTranslations("home");
  const features = [
    { icon: Layers, title: t("f1t"), body: t("f1b") },
    { icon: Gauge, title: t("f2t"), body: t("f2b") },
    { icon: BadgeCheck, title: t("f3t"), body: t("f3b") },
  ];

  return (
    <>
      <SiteHeader showSearch={false} />
      <main className="flex-1">
        <section className="relative overflow-hidden border-b">
          <div className="bg-[radial-gradient(ellipse_at_top,var(--color-accent),transparent_60%)] pointer-events-none absolute inset-0" />
          <div className="relative mx-auto max-w-3xl px-4 pt-20 pb-16 text-center sm:pt-28">
            <Badge variant="info" className="mb-5">
              <ShieldCheck /> {t("badge", { count: fmt(fp.techs.length) })}
            </Badge>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{t("title")}</h1>
            <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-lg text-pretty">{t("subtitle")}</p>
            <SearchForm size="lg" autoFocus className="mx-auto mt-8 max-w-xl text-left" />
          </div>
        </section>

        <section className="mx-auto grid max-w-[1700px] gap-4 px-4 py-14 md:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <Card key={title}>
              <CardHeader>
                <div className="bg-accent text-accent-foreground mb-2 grid size-9 place-items-center rounded-lg">
                  <Icon className="size-4.5" />
                </div>
                <CardTitle>{title}</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground text-sm leading-relaxed">{body}</CardContent>
            </Card>
          ))}
        </section>
      </main>
      <SiteDirectory />
      <SiteFooter />
    </>
  );
}
