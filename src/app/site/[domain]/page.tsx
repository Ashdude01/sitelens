import { Suspense } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { after, connection } from "next/server";
import { CircleAlert } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { SiteDirectory } from "@/components/site-directory";
import { ReportSkeleton, ReportView, ReportHeader } from "@/components/report/report-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { compact } from "@/lib/format";
import type { CachedReport, TechChange } from "@/lib/types";
import {
  InputError,
  RateLimitError,
  getOrScanReport,
  getReport,
  getTechHistory,
  isFresh,
  normalizeTarget,
  scanAndSave,
  type Target,
} from "@/server/services/report-service";

export const maxDuration = 60;

function parseTarget(raw: string): Target | null {
  try {
    return normalizeTarget(decodeURIComponent(raw));
  } catch (e) {
    if (e instanceof InputError || e instanceof URIError) return null;
    throw e;
  }
}

export async function generateMetadata({ params }: PageProps<"/site/[domain]">): Promise<Metadata> {
  const target = parseTarget((await params).domain);
  if (!target) return { title: "Not found", robots: { index: false } };
  const r = await getReport(target.key);
  const techs = r?.technologies.filter((t) => t.confidence >= 50).slice(0, 6).map((t) => t.name) ?? [];
  const tr = r?.traffic;
  const trafficText = tr?.verified
    ? `${compact(tr.verified.monthlyVisits)} verified monthly visits`
    : tr?.estimate
      ? `an estimated ${compact(tr.estimate.monthlyVisits.low)}–${compact(tr.estimate.monthlyVisits.high)} monthly visits`
      : "traffic estimates";
  // Only data-rich reports are indexable (avoid thin programmatic pages).
  const indexable = !!r && r.fetch.ok && (!!tr?.estimate || !!tr?.verified || r.technologies.length >= 5);
  return {
    title: `${target.key} traffic estimate & tech stack`,
    description: `${target.key} is built with ${techs.join(", ") || "…"}. See its full technology stack, hosting and ${trafficText}.`,
    alternates: { canonical: `/site/${target.key}` },
    openGraph: r ? { images: [{ url: `/api/v1/card/${encodeURIComponent(target.key)}`, width: 1200, height: 630 }] } : undefined,
    twitter: r ? { card: "summary_large_image", images: [`/api/v1/card/${encodeURIComponent(target.key)}`] } : undefined,
    robots: indexable ? undefined : { index: false, follow: true },
  };
}

export default async function SitePage({ params }: PageProps<"/site/[domain]">) {
  await connection();
  const raw = (await params).domain;
  const target = parseTarget(raw);
  if (!target) notFound();
  if (decodeURIComponent(raw) !== target.key) permanentRedirect(`/site/${encodeURIComponent(target.key)}`);

  const cached = await getReport(target.key);
  let body: React.ReactNode;
  if (cached) {
    // Serve what we have immediately; refresh stale reports in the background after the response.
    if (!isFresh(cached)) after(() => scanAndSave(target).catch((e) => console.error("background rescan failed", e)));
    body = <ReportView report={cached} history={await getTechHistory(target.key)} />;
  } else {
    body = (
      <Suspense fallback={<ReportSkeleton domain={target.key} />}>
        <LiveReport domain={target.key} />
      </Suspense>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1700px] flex-1 px-4">{body}</main>
      <SiteDirectory exclude={target.key} />
      <SiteFooter />
    </>
  );
}

/** Streams in once the first scan finishes. */
async function LiveReport({ domain }: { domain: string }) {
  const { clientKeyFromHeaders } = await import("@/server/services/client-key");
  let data: { report: CachedReport; history: TechChange[] } | null = null;
  let message = "";
  try {
    const { report } = await getOrScanReport(domain, { clientKey: clientKeyFromHeaders(await headers()) });
    data = { report, history: await getTechHistory(report.domain) };
  } catch (e) {
    message =
      e instanceof RateLimitError || e instanceof InputError ? e.message : "The scan failed. The site may be down, very slow, or blocking bots.";
    if (!(e instanceof RateLimitError)) console.error("scan failed", domain, e);
  }
  if (data) return <ReportView report={data.report} history={data.history} />;
  return (
    <>
      <ReportHeader domain={domain} />
      <Alert variant="destructive" className="mb-12">
        <CircleAlert />
        <AlertTitle>Could not analyze {domain}</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    </>
  );
}
