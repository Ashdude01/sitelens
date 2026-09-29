import Link from "next/link";
import { Braces, TriangleAlert } from "lucide-react";
import type { CachedReport, TechChange } from "@/lib/types";
import { computeEstimates } from "@/lib/estimates";
import { computeScores } from "@/lib/estimates/scores";
import { summarize } from "@/lib/estimates/summary";
import { ago, fmt } from "@/lib/format";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Favicon } from "./favicon";
import { InfraCard } from "./infra-card";
import { WebsiteCard } from "./website-card";
import { TechChangesCard } from "./tech-changes-card";
import { TechStackCard } from "./tech-stack-card";
import { RescanButton } from "./rescan-button";
import { Section, SectionNav } from "./section-nav";
import { OverviewSection } from "./overview-section";
import { TrafficSection } from "./traffic-section";
import { EarningsSection } from "./earnings-section";
import { HealthSection } from "./health-section";
import { PageSpeedPanel } from "@/components/pagespeed/pagespeed-panel";
import { MediaSlot } from "@/components/media-slot";
import { loadFingerprints } from "@/server/scanner/fingerprints";
import { buildCardData } from "@/server/export/card-data";
import { config } from "@/server/config";
import { ExportDialog } from "./export-dialog";

export function ReportHeader({ domain, title, description, favicon, actions }: {
  domain: string;
  title?: string | null;
  description?: string | null;
  favicon?: string | null;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 pt-8 pb-5 sm:flex-row sm:items-start">
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <div className="bg-card grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border">
          <Favicon src={favicon} />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight break-all sm:text-3xl">{domain}</h1>
          {(title || description) && (
            <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
              {title}
              {title && description ? " · " : ""}
              {description}
            </p>
          )}
        </div>
      </div>
      {actions}
    </div>
  );
}

export function ReportView({ report, history }: { report: CachedReport; history: TechChange[] }) {
  // Fill in slugs/icons for reports cached before those fields existed.
  const fp = loadFingerprints();
  const r: CachedReport = {
    ...report,
    technologies: report.technologies.map((t) => ({ ...t, slug: t.slug ?? fp.byName[t.name]?.slug, icon: t.icon ?? fp.byName[t.name]?.icon })),
  };
  const est = computeEstimates(r);
  const scores = computeScores(r);
  const summary = summarize(r, est);
  const sections = ["overview", "traffic", "earnings", "technology", "infrastructure", ...(scores ? ["health"] : [])];

  return (
    <>
      <ReportHeader
        domain={r.domain}
        title={r.site?.title}
        description={r.site?.description}
        favicon={r.site?.favicon}
        actions={
          <div className="flex flex-wrap items-start gap-2">
            <span className="text-muted-foreground pt-1.5 text-xs">Scanned {ago(r.cache.ageHours)}</span>
            <Button asChild variant="outline" size="sm">
              <Link href={`/api/v1/lookup?domain=${encodeURIComponent(r.domain)}`} prefetch={false}>
                <Braces /> JSON
              </Link>
            </Button>
            <RescanButton domain={r.domain} />
            <ExportDialog data={buildCardData(r)} publicUrl={config.publicUrl} />
          </div>
        }
      />
      <SectionNav available={sections} />

      {r.notes.map((n) => (
        <Alert key={n} variant="warning" className="mb-6">
          <TriangleAlert />
          <AlertDescription>{n}</AlertDescription>
        </Alert>
      ))}

      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-8">
        <div className="min-w-0">
          <OverviewSection report={r} est={est} summary={summary} />
          {/* On smaller screens the PageSpeed panel sits right after the overview. */}
          <MediaSlot query="(max-width: 1279px)">
            <div className="mb-10">
              <PageSpeedPanel domain={r.domain} />
            </div>
          </MediaSlot>
          <TrafficSection report={r} est={est} />
          <EarningsSection est={est} />

          <Section id="technology" title="Technology">
            <div className="space-y-4">
              <TechStackCard technologies={r.technologies} />
              <TechChangesCard history={history} />
            </div>
          </Section>

          <Section id="infrastructure" title="Infrastructure">
            <div className="grid gap-4 lg:grid-cols-2">
              <InfraCard report={r} />
              <WebsiteCard report={r} />
            </div>
          </Section>

          <HealthSection scores={scores} />
        </div>
        <aside className="hidden xl:block" aria-label="Page speed">
          <div className="sticky top-32 max-h-[calc(100vh-9rem)] overflow-y-auto pb-6 [scrollbar-width:thin]">
            <MediaSlot query="(min-width: 1280px)">
              <PageSpeedPanel domain={r.domain} />
            </MediaSlot>
          </div>
        </aside>
      </div>

      <p className="text-muted-foreground border-t pt-4 pb-12 text-xs">
        {r.mode === "browser" ? "Browser render" : "HTML + DNS + SSL"} · {fmt(r.scanMs)} ms ·{" "}
        <Link href="/methodology" className="text-primary hover:underline">
          Methodology
        </Link>
      </p>
    </>
  );
}

export function ReportSkeleton({ domain }: { domain: string }) {
  return (
    <>
      <ReportHeader
        domain={domain}
        description="Analyzing: fetching the homepage, DNS and SSL records. This usually takes 2–10 seconds."
        actions={<Skeleton className="h-8 w-28" />}
      />
      <div className="space-y-4 pb-12" aria-busy="true" aria-label="Loading report">
        <Skeleton className="h-20" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-5">
          <Skeleton className="h-72 lg:col-span-3" />
          <Skeleton className="h-72 lg:col-span-2" />
        </div>
      </div>
    </>
  );
}
