import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { pageAlternates } from "@/i18n/alternates";
import { isLocale } from "@/i18n/locales";
import { ChevronRight } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { TechIcon } from "@/components/report/tech-icon";
import { loadFingerprints, slugify } from "@/server/scanner/fingerprints";
import { techUsageCounts } from "@/server/repositories/reports";
import { fmt } from "@/lib/format";

function findCategory(slug: string) {
  const fp = loadFingerprints();
  const entry = Object.entries(fp.categories).find(([, c]) => slugify(c.name) === slug);
  if (!entry) return null;
  const id = Number(entry[0]);
  return { fp, id, name: entry[1].name, techs: fp.techs.filter((t) => t.cats.includes(id)) };
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; category: string }> }): Promise<Metadata> {
  const { locale, category } = await params;
  const t = await getTranslations("technologies");
  const c = findCategory(category);
  if (!c) return { title: t("notFound"), robots: { index: false } };
  return {
    title: t("catMeta", { name: c.name }),
    description: t("catDescription", { count: c.techs.length, name: c.name.toLowerCase() }),
    alternates: isLocale(locale) ? pageAlternates(`/technologies/${category}`, locale) : undefined,
  };
}

export const revalidate = 3600;

export default async function CategoryPage({ params }: { params: Promise<{ locale: string; category: string }> }) {
  const t = await getTranslations("technologies");
  const c = findCategory((await params).category);
  if (!c) notFound();
  const usage = await techUsageCounts();
  const techs = c.techs.sort((a, b) => (usage.get(b.name) ?? 0) - (usage.get(a.name) ?? 0) || a.name.localeCompare(b.name));
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1700px] flex-1 px-4 py-10">
        <nav aria-label={t("breadcrumb")} className="text-muted-foreground flex items-center gap-1 text-sm">
          <Link href="/technologies" className="hover:text-foreground">{t("title")}</Link>
          <ChevronRight className="size-3.5" />
          <span className="text-foreground">{c.name}</span>
        </nav>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">{c.name}</h1>
        <p className="text-muted-foreground mt-2">{t("catIntro", { count: fmt(techs.length) })}</p>
        <ul className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {techs.map((t) => (
            <li key={t.name}>
              <Link href={`/technology/${t.slug}`} className="bg-card hover:border-primary/40 flex items-center gap-3 rounded-lg border p-3 transition-colors">
                <TechIcon name={t.name} icon={t.icon} className="size-6" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.name}</span>
                {(usage.get(t.name) ?? 0) > 0 && <span className="text-muted-foreground text-xs tabular-nums">{fmt(usage.get(t.name))}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </>
  );
}
