// Optional live data providers. Both are no-ops unless configured.
import { fetch as ufetch } from "undici";
import { config } from "../config";
import type { CruxRecord, OrganicEstimate } from "@/lib/types";

/** Chrome UX Report API: real-user Core Web Vitals + device split. Free with a Google API key. */
export async function getCruxRecord(origin: string): Promise<CruxRecord | null> {
  if (!config.cruxApiKey) return null;
  try {
    const res = await ufetch(
      `https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${encodeURIComponent(config.cruxApiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ origin }),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (res.status === 404) return { inCrux: false };
    if (!res.ok) return null;
    type Metric = { percentiles?: { p75?: number | string }; fractions?: Record<string, number> };
    const j = (await res.json()) as { record?: { metrics?: Record<string, Metric>; collectionPeriod?: unknown } };
    const m = j.record?.metrics ?? {};
    const p75 = (k: string) => (m[k]?.percentiles?.p75 ?? null) as number | null;
    return {
      inCrux: true,
      collectionPeriod: j.record?.collectionPeriod ?? null,
      coreWebVitals: {
        lcpMs: p75("largest_contentful_paint"),
        inpMs: p75("interaction_to_next_paint"),
        cls: p75("cumulative_layout_shift"),
        fcpMs: p75("first_contentful_paint"),
        ttfbMs: p75("experimental_time_to_first_byte") ?? p75("time_to_first_byte"),
      },
      deviceSplit: m.form_factors?.fractions ?? null,
      navigationTypes: m.navigation_types?.fractions ?? null,
    };
  } catch {
    return null;
  }
}

/** DataForSEO Labs: estimated Google organic traffic (rankings x volume x CTR). Paid, ~1 cent per call. */
export async function getOrganicEstimate(domain: string): Promise<OrganicEstimate | null> {
  const d = config.dataforseo;
  if (!d) return null;
  try {
    const res = await ufetch("https://api.dataforseo.com/v3/dataforseo_labs/google/domain_rank_overview/live", {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${d.login}:${d.password}`).toString("base64")}`,
        "content-type": "application/json",
      },
      body: JSON.stringify([{ target: domain, location_code: d.locationCode, language_code: d.languageCode }]),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    type Organic = { count?: number; etv?: number; pos_1?: number; pos_2_3?: number };
    const j = (await res.json()) as { tasks?: { result?: { items?: { metrics?: { organic?: Organic } }[] }[] }[] };
    const organic = j.tasks?.[0]?.result?.[0]?.items?.[0]?.metrics?.organic;
    if (!organic) return { keywords: 0, monthlyOrganicVisits: 0 };
    return {
      keywords: organic.count ?? 0,
      monthlyOrganicVisits: Math.round(organic.etv ?? 0),
      top3Keywords: (organic.pos_1 ?? 0) + (organic.pos_2_3 ?? 0),
      locationCode: d.locationCode,
    };
  } catch {
    return null;
  }
}
