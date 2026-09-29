import type { Metadata } from "next";
import { connection } from "next/server";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { config } from "@/server/config";
import { listSources } from "@/server/repositories/ranks";
import { loadFingerprints } from "@/server/scanner/fingerprints";
import { loadCalibration } from "@/server/traffic/estimator";
import { fmt, isoDate } from "@/lib/format";
import { ADBLOCK_RATE, RPM_BY_TIER, RPM_UNKNOWN_MIX, SITE_TYPES, WORTH_MONTHS_OF_REVENUE } from "@/lib/estimates/assumptions";

export const metadata: Metadata = {
  title: "Methodology",
  description: "How we detect technologies and estimate website traffic, and how accurate it is.",
};

export default async function MethodologyPage() {
  await connection();
  const [lists, cal] = await Promise.all([listSources(), Promise.resolve(loadCalibration(config.dataDir))]);
  const techCount = loadFingerprints().techs.length;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
        <article className="prose-sm space-y-6 leading-relaxed [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_p]:text-muted-foreground">
          <h1 className="text-3xl font-semibold tracking-tight">How {config.siteName} works</h1>
          <p>We want every number on this site to be honest. Here is exactly where it comes from.</p>

          <h2>Technology detection (high accuracy)</h2>
          <p>
            We fetch the homepage like a browser would. We look for fingerprints in HTTP headers, cookies, HTML, script URLs, meta tags, DNS records
            (MX, NS, TXT) and the SSL certificate. The fingerprints come from the community-maintained, open Wappalyzer-format database (
            {fmt(techCount)} technologies). Each detection on a report lists the evidence we found. We respect robots.txt.
          </p>

          <h2>Traffic estimates (ranges, not exact numbers)</h2>
          <p>
            Only a site&apos;s owner knows its exact traffic. Everyone else, including large paid tools, estimates it. Independent tests have found
            average errors around 50% even for the biggest tools, and much worse for small sites.
          </p>
          <p>We use public popularity lists that are licensed for commercial use:</p>
          <div className="flex flex-wrap gap-2">
            {lists.length ? (
              lists.map((s) => (
                <Badge key={s.source} variant="secondary">
                  {s.source}: {fmt(s.n)} domains{s.updated ? `, updated ${s.updated}` : ""}
                </Badge>
              ))
            ) : (
              <Badge variant="warning">No lists imported yet</Badge>
            )}
          </div>
          <p>
            Each list&apos;s rank is converted to visits with a model of the form <code className="bg-muted rounded px-1">log(visits) = a + b · log(rank)</code>.
            When several lists cover a site we combine them; when they disagree, the range gets wider. We show a range covering roughly two out of
            three cases, plus a confidence level. If a site is not in any list, we say &quot;not enough data&quot; instead of inventing a number.
          </p>

          <h2>Calibration status</h2>
          <p>
            {cal.calibrated ? (
              <>
                The model was fitted on real traffic data on {isoDate(cal.fittedAt ?? null)}. {cal.note}
              </>
            ) : (
              <>
                <strong className="text-foreground">The model is not calibrated yet.</strong> It uses rough default assumptions, so treat estimates
                as approximate orders of magnitude.
              </>
            )}
          </p>

          <h2>Pageviews, engagement and visitors (modeled)</h2>
          <p>
            We don&apos;t see a site&apos;s analytics, so pages per visit, visit duration and bounce rate are industry benchmarks for the kind of
            site we detect (store, blog, news, app…), clearly labelled as typical rather than measured:
          </p>
          <div className="overflow-x-auto rounded-lg border text-sm">
            <table className="w-full">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-2 font-medium">Site type</th>
                  <th className="p-2 font-medium">Pages / visit</th>
                  <th className="p-2 font-medium">Duration</th>
                  <th className="p-2 font-medium">Bounce</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                {Object.values(SITE_TYPES).map((t) => (
                  <tr key={t.label} className="border-t">
                    <td className="text-foreground p-2">{t.label}</td>
                    <td className="p-2 tabular-nums">{t.pagesPerVisit.join("–")}</td>
                    <td className="p-2 tabular-nums">{t.durationSec.map((x) => `${Math.round(x / 60 * 10) / 10}m`).join("–")}</td>
                    <td className="p-2 tabular-nums">{t.bouncePct.join("–")}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2>Earnings and worth (modeled)</h2>
          <p>
            Display-ad revenue = pageviews × revenue per 1,000 pageviews (RPM) × share not ad-blocked. RPM depends on where visitors are:
            ${RPM_BY_TIER.t1.join("–")} for the US, UK, Canada, Australia and Northern Europe; ${RPM_BY_TIER.t2.join("–")} for the rest of Europe,
            Japan, Korea and the Gulf; ${RPM_BY_TIER.t3.join("–")} for India and most other markets; ${RPM_UNKNOWN_MIX.join("–")} when we
            don&apos;t know. We assume {ADBLOCK_RATE.map((x) => Math.round(x * 100)).join("–")}% of pageviews are ad-blocked.
          </p>
          <p>
            If we detect an ad network (such as Google AdSense) we call it <em>estimated ad revenue</em>; if not, <em>ad potential</em>, because the
            site probably earns in other ways. Worth is {WORTH_MONTHS_OF_REVENUE.join("–")} months of that revenue, a common range for content
            sites. For stores and software products it is only a floor.
          </p>
          <p>
            Every step has a range. We combine them the statistically correct way (in log space), so ranges stay useful instead of multiplying
            worst cases together.
          </p>

          <h2>Verified traffic</h2>
          <p>
            Site owners will be able to connect Google Analytics or Search Console to show exact numbers with a &quot;Verified&quot; badge. Verified
            sites are also used to calibrate estimates for everyone else.
          </p>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
