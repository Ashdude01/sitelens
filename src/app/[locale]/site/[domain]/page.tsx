import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { permanentRedirect } from "@/i18n/navigation";
import { pageAlternates } from "@/i18n/alternates";
import { isLocale } from "@/i18n/locales";
import { after } from "next/server";
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
import { translateError } from "@/i18n/errors";

export const maxDuration = 60;
export const revalidate = 86400;

function parseTarget(raw: string): Target | null {
  try {
    return normalizeTarget(decodeURIComponent(raw));
  } catch (e) {
    if (e instanceof InputError || e instanceof URIError) return null;
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; domain: string }> }): Promise<Metadata> {
  const { locale, domain } = await params;
  const t = await getTranslations("report");
  const target = parseTarget(domain);
  if (!target) return { title: t("notFound"), robots: { index: false } };
  const r = await getReport(target.key);
  const techs = r?.technologies.filter((t) => t.confidence >= 50).slice(0, 6).map((t) => t.name) ?? [];
  const tr = r?.traffic;
  const trafficText = tr?.verified
    ? t("trafficVerified", { n: compact(tr.verified.monthlyVisits) })
    : tr?.estimate
      ? t("trafficRange", { low: compact(tr.estimate.monthlyVisits.low), high: compact(tr.estimate.monthlyVisits.high) })
      : t("trafficUnknown");
  // Only data-rich reports are indexable (avoid thin programmatic pages).
  const indexable = !!r && r.fetch.ok && (!!tr?.estimate || !!tr?.verified || r.technologies.length >= 5);
  return {
    title: t("metaTitle", { domain: target.key }),
    description: t("metaDescription", { domain: target.key, techs: techs.join(", ") || "…", traffic: trafficText }),
    alternates: isLocale(locale) ? pageAlternates(`/site/${target.key}`, locale) : undefined,
    openGraph: r ? { images: [{ url: `/api/v1/card/${encodeURIComponent(target.key)}`, width: 1200, height: 630 }] } : undefined,
    twitter: r ? { card: "summary_large_image", images: [`/api/v1/card/${encodeURIComponent(target.key)}`] } : undefined,
    robots: indexable ? undefined : { index: false, follow: true },
  };
}

export default async function SitePage({ params }: { params: Promise<{ locale: string; domain: string }> }) {
  const { locale, domain: raw } = await params;
  const target = parseTarget(raw);
  if (!target || !isLocale(locale)) notFound();
  if (decodeURIComponent(raw) !== target.key) permanentRedirect({ href: `/site/${encodeURIComponent(target.key)}`, locale });

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
    message = await translateError(
      e instanceof RateLimitError || e instanceof InputError ? e.message : "The scan failed. The site may be down, very slow, or blocking bots.",
    );
    if (!(e instanceof RateLimitError)) console.error("scan failed", domain, e);
  }
  if (data) return <ReportView report={data.report} history={data.history} />;
  return (
    <>
      <ReportHeader domain={domain} />
      <Alert variant="destructive" className="mb-12">
        <CircleAlert />
        <AlertTitle>{(await getTranslations("errors"))("analyzeFail", { domain })}</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    </>
  );
}
