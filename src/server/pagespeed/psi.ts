// Google PageSpeed Insights v5 client + normalizer.
// Free API. With a key the Cloud quota is 25,000 requests/day and 240/minute.
import { fetch as ufetch } from "undici";
import { config } from "../config";
import { ratingOf, type PsiFieldMetric, type PsiResult, type PsiStrategy, type Rating } from "@/lib/pagespeed-types";

type Audit = { title?: string; score?: number | null; displayValue?: string; numericValue?: number; details?: { type?: string; data?: string; overallSavingsMs?: number } };
type FieldMetric = { percentile?: number; category?: string; distributions?: { min: number; max?: number; proportion: number }[] };
type Experience = { metrics?: Record<string, FieldMetric>; overall_category?: string; origin_fallback?: boolean };
interface RawPsi {
  id?: string;
  loadingExperience?: Experience;
  originLoadingExperience?: Experience;
  lighthouseResult?: {
    finalUrl?: string;
    finalDisplayedUrl?: string;
    categories?: Record<string, { score: number | null; title: string }>;
    audits?: Record<string, Audit>;
  };
}

const FIELD: { key: string; id: PsiFieldMetric["id"]; label: string; core: boolean; scale?: number }[] = [
  { key: "LARGEST_CONTENTFUL_PAINT_MS", id: "LCP", label: "Largest Contentful Paint", core: true },
  { key: "INTERACTION_TO_NEXT_PAINT", id: "INP", label: "Interaction to Next Paint", core: true },
  { key: "CUMULATIVE_LAYOUT_SHIFT_SCORE", id: "CLS", label: "Cumulative Layout Shift", core: true, scale: 100 },
  { key: "FIRST_CONTENTFUL_PAINT_MS", id: "FCP", label: "First Contentful Paint", core: false },
  { key: "EXPERIMENTAL_TIME_TO_FIRST_BYTE", id: "TTFB", label: "Time to First Byte", core: false },
];

const CATEGORY_RATING: Record<string, Rating> = { FAST: "good", AVERAGE: "needs-improvement", SLOW: "poor" };

const LAB = [
  ["first-contentful-paint", "First Contentful Paint"],
  ["largest-contentful-paint", "Largest Contentful Paint"],
  ["total-blocking-time", "Total Blocking Time"],
  ["cumulative-layout-shift", "Cumulative Layout Shift"],
  ["speed-index", "Speed Index"],
] as const;

function normalizeField(exp: Experience | undefined): { metrics: PsiFieldMetric[]; overall?: string } | null {
  if (!exp?.metrics) return null;
  const metrics: PsiFieldMetric[] = [];
  for (const f of FIELD) {
    const m = exp.metrics[f.key];
    if (!m || m.percentile == null) continue;
    const d = m.distributions ?? [];
    const dist: [number, number, number] = [d[0]?.proportion ?? 0, d[1]?.proportion ?? 0, d[2]?.proportion ?? 0];
    metrics.push({
      id: f.id,
      label: f.label,
      p75: f.scale ? m.percentile / f.scale : m.percentile,
      rating: CATEGORY_RATING[m.category ?? ""] ?? "needs-improvement",
      distribution: dist,
      core: f.core,
    });
  }
  return metrics.length ? { metrics, overall: exp.overall_category } : null;
}

export function normalizePsi(raw: RawPsi, strategy: PsiStrategy): PsiResult {
  const lh = raw.lighthouseResult ?? {};
  const audits = lh.audits ?? {};
  const cats = lh.categories ?? {};

  // Prefer page-level field data; fall back to origin-level.
  const page = raw.loadingExperience && !raw.loadingExperience.origin_fallback ? normalizeField(raw.loadingExperience) : null;
  const origin = page ? null : normalizeField(raw.originLoadingExperience ?? raw.loadingExperience);
  const fieldData = page ?? origin;
  let field: PsiResult["field"] = null;
  if (fieldData) {
    const core = fieldData.metrics.filter((m) => m.core);
    const passed = core.length >= 2 ? core.every((m) => m.rating === "good") : null;
    field = { scope: page ? "url" : "origin", passed, metrics: fieldData.metrics };
  }

  const opportunities = Object.values(audits)
    .filter((a) => a.details?.type === "opportunity" && (a.details.overallSavingsMs ?? 0) >= 100 && (a.score ?? 1) < 0.9)
    .sort((a, b) => (b.details?.overallSavingsMs ?? 0) - (a.details?.overallSavingsMs ?? 0))
    .slice(0, 4)
    .map((a) => ({ title: a.title ?? "Improvement", savings: `${((a.details?.overallSavingsMs ?? 0) / 1000).toFixed(1)} s` }));

  const shot = audits["final-screenshot"]?.details?.data;
  return {
    strategy,
    fetchedAt: new Date().toISOString(),
    testedUrl: lh.finalDisplayedUrl ?? lh.finalUrl ?? raw.id ?? "",
    scores: (
      [
        ["performance", "Performance"],
        ["accessibility", "Accessibility"],
        ["best-practices", "Best practices"],
        ["seo", "SEO"],
      ] as const
    ).map(([id, label]) => ({ id, label, score: cats[id]?.score != null ? Math.round((cats[id].score as number) * 100) : null })),
    field,
    lab: LAB.filter(([id]) => audits[id]).map(([id, label]) => ({
      id,
      label,
      display: audits[id].displayValue ?? "—",
      rating: ratingOf(audits[id].score),
    })),
    opportunities,
    screenshot: typeof shot === "string" && shot.startsWith("data:image/") && shot.length < 200_000 ? shot : null,
  };
}

export class PsiError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

export async function runPagespeed(url: string, strategy: PsiStrategy): Promise<PsiResult> {
  const qs = new URLSearchParams({ url, strategy });
  for (const c of ["performance", "accessibility", "best-practices", "seo"]) qs.append("category", c);
  if (config.pagespeedApiKey) qs.set("key", config.pagespeedApiKey);
  const res = await ufetch(`${config.pagespeedApiBase}?${qs}`, { signal: AbortSignal.timeout(90_000) });
  if (res.status === 429) throw new PsiError("Google PageSpeed quota reached. Add a PAGESPEED_API_KEY or try again later.", 429);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new PsiError(body?.error?.message?.split("\n")[0] ?? `PageSpeed request failed (HTTP ${res.status}).`, res.status >= 500 ? 502 : 400);
  }
  return normalizePsi((await res.json()) as RawPsi, strategy);
}
