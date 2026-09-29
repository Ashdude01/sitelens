import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { TechIcon } from "@/components/report/tech-icon";
import { loadFingerprints, slugify } from "@/server/scanner/fingerprints";
import { techUsageCounts } from "@/server/repositories/reports";
import { fmt } from "@/lib/format";

export const metadata: Metadata = {
  title: "Web technologies: CMS, analytics, ecommerce and more",
  description: "Browse thousands of web technologies by category and see which websites use them.",
};

export default async function TechnologiesPage() {
  await connection();
  const fp = loadFingerprints();
  const usage = await techUsageCounts();
  const byCat = new Map<number, typeof fp.techs>();
  for (const t of fp.techs) for (const c of t.cats.slice(0, 1)) byCat.set(c, [...(byCat.get(c) ?? []), t]);
  const cats = [...byCat.entries()]
    .map(([id, techs]) => ({
      id,
      name: fp.categories[id]?.name ?? "Other",
      techs: techs.sort((a, b) => (usage.get(b.name) ?? 0) - (usage.get(a.name) ?? 0) || a.name.localeCompare(b.name)),
      used: techs.reduce((s, t) => s + (usage.get(t.name) ?? 0), 0),
    }))
    .sort((a, b) => b.used - a.used || b.techs.length - a.techs.length);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">Technologies</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          {fmt(fp.techs.length)} technologies across {cats.length} categories that we can detect. Pick one to see how we detect it and which sites use it.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cats.map((c) => (
            <div key={c.id} className="bg-card rounded-xl border p-4">
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <Link href={`/technologies/${slugify(c.name)}`} className="font-semibold hover:underline">{c.name}</Link>
                <span className="text-muted-foreground text-xs tabular-nums">{fmt(c.techs.length)}</span>
              </div>
              <ul className="space-y-1.5">
                {c.techs.slice(0, 5).map((t) => (
                  <li key={t.name}>
                    <Link href={`/technology/${t.slug}`} className="hover:text-primary flex items-center gap-2 text-sm">
                      <TechIcon name={t.name} icon={t.icon} />
                      <span className="truncate">{t.name}</span>
                      {(usage.get(t.name) ?? 0) > 0 && <span className="text-muted-foreground ml-auto text-xs tabular-nums">{fmt(usage.get(t.name))} sites</span>}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href={`/technologies/${slugify(c.name)}`} className="text-primary mt-3 inline-block text-xs hover:underline">
                View all →
              </Link>
            </div>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
