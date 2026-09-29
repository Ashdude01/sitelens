// Normalized Google PageSpeed Insights result (shared by server and client).

export type PsiStrategy = "mobile" | "desktop";
export type Rating = "good" | "needs-improvement" | "poor";

export interface PsiFieldMetric {
  id: "LCP" | "INP" | "CLS" | "FCP" | "TTFB";
  label: string;
  /** p75 value in the metric's unit (ms, or unitless for CLS). */
  p75: number;
  rating: Rating;
  /** Share of page loads that were good / needs improvement / poor. */
  distribution: [good: number, ni: number, poor: number];
  core: boolean;
}

export interface PsiResult {
  strategy: PsiStrategy;
  fetchedAt: string;
  testedUrl: string;
  scores: { id: "performance" | "accessibility" | "best-practices" | "seo"; label: string; score: number | null }[];
  field: {
    /** "url" = data for this exact page, "origin" = whole-site fallback. */
    scope: "url" | "origin";
    /** Passed / failed Core Web Vitals assessment (LCP, INP, CLS all good at p75). */
    passed: boolean | null;
    metrics: PsiFieldMetric[];
  } | null;
  lab: { id: string; label: string; display: string; rating: Rating }[];
  opportunities: { title: string; savings: string }[];
  screenshot: string | null;
}

export const ratingOf = (score: number | null | undefined): Rating =>
  score == null ? "poor" : score >= 0.9 ? "good" : score >= 0.5 ? "needs-improvement" : "poor";

export const scoreRating = (score: number | null): Rating => (score == null ? "poor" : score >= 90 ? "good" : score >= 50 ? "needs-improvement" : "poor");

export function formatMetric(id: PsiFieldMetric["id"], v: number): string {
  if (id === "CLS") return v.toFixed(2);
  if (v >= 1000) return `${(v / 1000).toFixed(1)} s`;
  return `${Math.round(v)} ms`;
}
