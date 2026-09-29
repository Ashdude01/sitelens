import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ChevronRight, ExternalLink, Fingerprint, Globe, Layers, Link2, Search } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { SiteCardGrid } from "@/components/site-card";
import { SiteDirectory } from "@/components/site-directory";
import { TechIcon } from "@/components/report/tech-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadFingerprints, slugify, type CompiledTech } from "@/server/scanner/fingerprints";
import { sitesUsingTech, techUsageCounts } from "@/server/repositories/reports";
import { DETECTION_LABELS, PRICING_LABELS } from "@/lib/tech-meta";
import { fmt } from "@/lib/format";

const INDEX_MIN_SITES = 3; // below this the page is thin, so we keep it out of search engines

function detectionKinds(t: CompiledTech): string[] {
  const kinds: string[] = [];
  if (Object.keys(t.headers).length) kinds.push("headers");
  if (t.cookies.length) kinds.push("cookies");
  if (Object.keys(t.meta).length) kinds.push("meta");
  if (t.scriptSrc.length) kinds.push("scriptSrc");
  if (t.scripts.length) kinds.push("scripts");
  if (t.html.length) kinds.push("html");
  if (t.dom) kinds.push("dom");
  if (Object.keys(t.js).length) kinds.push("js");
  if (Object.keys(t.dns).length) kinds.push("dns");
  if (t.certIssuer.length) kinds.push("certIssuer");
  if (t.url.length) kinds.push("url");
  return kinds;
}

async function load(slug: string) {
  const fp = loadFingerprints();
  const tech = fp.bySlug[slug];
  if (!tech) return null;
  return { fp, tech, categories: tech.cats.map((id) => fp.categories[id]?.name).filter(Boolean) as string[] };
}

export async function generateMetadata({ params }: PageProps<"/technology/[slug]">): Promise<Metadata> {
  const d = await load((await params).slug);
  if (!d) return { title: "Technology not found", robots: { index: false } };
  const { total } = await sitesUsingTech(d.tech.name, 1);
  return {
    title: `${d.tech.name}: websites using ${d.tech.name} & how to detect it`,
    description: `${d.tech.description ?? `${d.tech.name} is a ${d.categories[0] ?? "web technology"}.`} See websites using ${d.tech.name} and how we detect it.`.slice(0, 300),
    alternates: { canonical: `/technology/${d.tech.slug}` },
    robots: total >= INDEX_MIN_SITES ? undefined : { index: false, follow: true },
  };
}

export default async function TechnologyPage({ params }: PageProps<"/technology/[slug]">) {
  await connection();
  const d = await load((await params).slug);
  if (!d) notFound();
  const { fp, tech, categories } = d;
  const [{ total, sites }, usage] = await Promise.all([sitesUsingTech(tech.name, 24), techUsageCounts()]);

  const kinds = detectionKinds(tech);
  const implies = tech.implies.map((p) => fp.byName[p.raw]).filter(Boolean);
  const impliedBy = fp.techs.filter((t) => t.implies.some((p) => p.raw === tech.name)).sort((a, b) => (usage.get(b.name) ?? 0) - (usage.get(a.name) ?? 0)).slice(0, 12);
  const primaryCat = tech.cats[0];
  const alternatives = fp.techs
    .filter((t) => t.name !== tech.name && t.cats[0] === primaryCat)
    .sort((a, b) => (usage.get(b.name) ?? 0) - (usage.get(a.name) ?? 0) || a.name.localeCompare(b.name))
    .slice(0, 12);

  const chip = (t: CompiledTech) => (
    <Link
      key={t.name}
      href={`/technology/${t.slug}`}
      className="bg-secondary hover:bg-accent hover:text-accent-foreground inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm transition-colors"
    >
      <TechIcon name={t.name} icon={t.icon} />
      <span className="font-medium">{t.name}</span>
      {(usage.get(t.name) ?? 0) > 0 && <span className="text-muted-foreground text-xs tabular-nums">{fmt(usage.get(t.name))}</span>}
    </Link>
  );

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1700px] flex-1 px-4">
        <nav aria-label="Breadcrumb" className="text-muted-foreground flex items-center gap-1 pt-6 text-sm">
          <Link href="/technologies" className="hover:text-foreground">Technologies</Link>
          {categories[0] && (
            <>
              <ChevronRight className="size-3.5" />
              <Link href={`/technologies/${slugify(categories[0])}`} className="hover:text-foreground">{categories[0]}</Link>
            </>
          )}
          <ChevronRight className="size-3.5" />
          <span className="text-foreground truncate">{tech.name}</span>
        </nav>

        <header className="flex flex-col gap-5 py-8 sm:flex-row sm:items-start">
          <div className="bg-card grid size-20 shrink-0 place-items-center rounded-2xl border p-3">
            <TechIcon name={tech.name} icon={tech.icon} className="size-full text-2xl" />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight">{tech.name}</h1>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <Badge key={c} variant="secondary" asChild>
                  <Link href={`/technologies/${slugify(c)}`}>{c}</Link>
                </Badge>
              ))}
              {tech.oss && <Badge variant="success">Open source</Badge>}
              {tech.saas && <Badge variant="info">SaaS</Badge>}
              {tech.pricing.map((p) => (
                <Badge key={p} variant="outline">{PRICING_LABELS[p] ?? p}</Badge>
              ))}
            </div>
            {tech.description && <p className="text-muted-foreground max-w-3xl leading-relaxed">{tech.description}</p>}
          </div>
          {tech.website && (
            <Button asChild variant="outline">
              <a href={tech.website} target="_blank" rel="noopener noreferrer">
                <Globe /> Official website <ExternalLink className="size-3.5" />
              </a>
            </Button>
          )}
        </header>

        <div className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            [Globe, "Sites using it", fmt(total), "in our scanned database"],
            [Layers, "Category", categories[0] ?? "—", categories.length > 1 ? `+${categories.length - 1} more` : " "],
            [Fingerprint, "Detection methods", String(kinds.length), "independent fingerprints"],
            [Link2, "Related technologies", String(implies.length + impliedBy.length), "runs on / used by"],
          ].map(([Icon, label, value, note]) => {
            const I = Icon as typeof Globe;
            return (
              <div key={label as string} className="bg-card rounded-xl border p-4">
                <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                  <I className="size-3.5" /> {label as string}
                </p>
                <p className="mt-1 truncate text-2xl font-semibold tracking-tight">{value as string}</p>
                <p className="text-muted-foreground text-[11px]">{note as string}</p>
              </div>
            );
          })}
        </div>

        <section className="mb-10">
          <h2 className="mb-1 text-lg font-semibold tracking-tight">Websites using {tech.name}</h2>
          <p className="text-muted-foreground mb-4 text-sm">
            {total ? `Sites we have scanned that currently run ${tech.name}, most visited first.` : `We haven't seen ${tech.name} on a scanned site yet.`}
          </p>
          {sites.length ? (
            <SiteCardGrid sites={sites} />
          ) : (
            <Card className="py-8">
              <CardContent className="text-muted-foreground flex flex-col items-center gap-3 text-center text-sm">
                <Search className="size-5" />
                Analyze a website to see if it uses {tech.name}.
                <Button asChild size="sm">
                  <Link href="/">Analyze a site</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </section>

        <div className="mb-10 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Fingerprint className="text-muted-foreground size-4" /> How we detect {tech.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {kinds.length ? (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {kinds.map((k) => (
                    <li key={k} className="bg-muted/50 rounded-lg p-3">
                      <p className="text-sm font-medium">{DETECTION_LABELS[k]?.label ?? k}</p>
                      <p className="text-muted-foreground text-xs">{DETECTION_LABELS[k]?.hint}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">Only detected when another technology implies it.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="text-muted-foreground size-4" /> Related technologies
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {implies.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-2 text-xs font-medium">{tech.name} runs on</p>
                  <div className="flex flex-wrap gap-1.5">{implies.map(chip)}</div>
                </div>
              )}
              {impliedBy.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-2 text-xs font-medium">Built on {tech.name}</p>
                  <div className="flex flex-wrap gap-1.5">{impliedBy.map(chip)}</div>
                </div>
              )}
              {!implies.length && !impliedBy.length && <p className="text-muted-foreground text-sm">No known dependencies.</p>}
            </CardContent>
          </Card>
        </div>

        {alternatives.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-1 text-lg font-semibold tracking-tight">Alternatives in {categories[0]}</h2>
            <p className="text-muted-foreground mb-4 text-sm">Numbers show how many scanned sites use each.</p>
            <div className="flex flex-wrap gap-1.5">{alternatives.map(chip)}</div>
            <Link href={`/technologies/${slugify(categories[0] ?? "")}`} className="text-primary mt-3 inline-block text-sm hover:underline">
              All {categories[0]} technologies →
            </Link>
          </section>
        )}
      </main>
      <SiteDirectory />
      <SiteFooter />
    </>
  );
}
