import { connection } from "next/server";
import { BadgeCheck, Gauge, Layers, ShieldCheck } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { SearchForm } from "@/components/search-form";
import { SiteDirectory } from "@/components/site-directory";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadFingerprints } from "@/server/scanner/fingerprints";
import { fmt } from "@/lib/format";

const FEATURES = [
  {
    icon: Layers,
    title: "Tech stack, with proof",
    body: "CMS, frameworks, analytics, CDN, email, payments and more. Each detection shows the header, script or DNS record that gave it away.",
  },
  {
    icon: Gauge,
    title: "Honest traffic ranges",
    body: "Nobody but the owner knows exact traffic. We combine public popularity signals and show a range with a confidence level, never a fake-precise number.",
  },
  {
    icon: BadgeCheck,
    title: "Verified when possible",
    body: "Site owners will be able to connect analytics to show exact numbers. Those sites also calibrate estimates for everyone else.",
  },
];

export default async function HomePage() {
  await connection();
  const fp = loadFingerprints();

  return (
    <>
      <SiteHeader showSearch={false} />
      <main className="flex-1">
        <section className="relative overflow-hidden border-b">
          <div className="bg-[radial-gradient(ellipse_at_top,var(--color-accent),transparent_60%)] pointer-events-none absolute inset-0" />
          <div className="relative mx-auto max-w-3xl px-4 pt-20 pb-16 text-center sm:pt-28">
            <Badge variant="info" className="mb-5">
              <ShieldCheck /> {fmt(fp.techs.length)} technologies · evidence on every detection
            </Badge>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              What is any website built with, and how big is it?
            </h1>
            <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-lg text-pretty">
              Enter a domain to see its tech stack, hosting, email and SSL setup, and a traffic range with a confidence level.
            </p>
            <SearchForm size="lg" autoFocus className="mx-auto mt-8 max-w-xl text-left" />
          </div>
        </section>

        <section className="mx-auto grid max-w-[1700px] gap-4 px-4 py-14 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
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
