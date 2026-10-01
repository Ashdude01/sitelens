import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { pageAlternates } from "@/i18n/alternates";
import { isLocale } from "@/i18n/locales";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { config } from "@/server/config";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations("apiDocs");
  return {
    title: t("title"),
    description: t("description"),
    alternates: isLocale(locale) ? pageAlternates("/docs/api", locale) : undefined,
  };
}

export default async function ApiDocsPage() {
  const t = await getTranslations("apiDocs");
  const fields: [string, string][] = [
    ["technologies[]", t("f1")],
    ["traffic", t("f2")],
    ["hosting", t("f3")],
    ["cert / registration", t("f4")],
    ["site / security", t("f5")],
  ];
  const ex = `${config.publicUrl}/api/v1/lookup?domain=example.com`;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
        <Card className="py-4">
          <CardContent className="overflow-x-auto font-mono text-sm">
            <p>GET {ex}</p>
            <p className="text-muted-foreground">GET {ex}&amp;refresh=1 &nbsp;# {t("refresh")}</p>
          </CardContent>
        </Card>
        <dl className="divide-y rounded-xl border text-sm">
          {fields.map(([k, v]) => (
            <div key={k} className="grid gap-1 p-3 sm:grid-cols-[180px_1fr]">
              <dt className="font-mono">{k}</dt>
              <dd className="text-muted-foreground">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-muted-foreground text-sm">
          {t("status", { n: config.freshScansPerHour })}
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
