// A trimmed PageSpeed Insights v5 response with the fields we read.
export function psiFixture(strategy: "mobile" | "desktop") {
  const slow = strategy === "mobile";
  const dist = (g: number, n: number) => [
    { min: 0, max: 1, proportion: g },
    { min: 1, max: 2, proportion: n },
    { min: 2, proportion: +(1 - g - n).toFixed(4) },
  ];
  return {
    id: "http://127.0.0.2:8080/home/",
    loadingExperience: {
      origin_fallback: false,
      overall_category: slow ? "AVERAGE" : "FAST",
      metrics: {
        LARGEST_CONTENTFUL_PAINT_MS: { percentile: slow ? 3100 : 1900, category: slow ? "AVERAGE" : "FAST", distributions: dist(slow ? 0.62 : 0.86, 0.25) },
        INTERACTION_TO_NEXT_PAINT: { percentile: 180, category: "FAST", distributions: dist(0.8, 0.15) },
        CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 5, category: "FAST", distributions: dist(0.9, 0.07) },
        FIRST_CONTENTFUL_PAINT_MS: { percentile: 1600, category: "FAST", distributions: dist(0.78, 0.15) },
        EXPERIMENTAL_TIME_TO_FIRST_BYTE: { percentile: 900, category: "AVERAGE", distributions: dist(0.55, 0.35) },
      },
    },
    lighthouseResult: {
      finalDisplayedUrl: "http://127.0.0.2:8080/home/",
      categories: {
        performance: { score: slow ? 0.64 : 0.93, title: "Performance" },
        accessibility: { score: 0.88, title: "Accessibility" },
        "best-practices": { score: 0.96, title: "Best Practices" },
        seo: { score: 1, title: "SEO" },
      },
      audits: {
        "first-contentful-paint": { score: 0.8, displayValue: "1.8 s", numericValue: 1800 },
        "largest-contentful-paint": { score: slow ? 0.45 : 0.9, displayValue: slow ? "4.2 s" : "1.2 s", numericValue: 4200 },
        "total-blocking-time": { score: 0.7, displayValue: "310 ms", numericValue: 310 },
        "cumulative-layout-shift": { score: 1, displayValue: "0.01", numericValue: 0.01 },
        "speed-index": { score: 0.6, displayValue: "4.9 s", numericValue: 4900 },
        "render-blocking-resources": { title: "Eliminate render-blocking resources", score: 0.3, details: { type: "opportunity", overallSavingsMs: 1250 } },
        "unused-javascript": { title: "Reduce unused JavaScript", score: 0.4, details: { type: "opportunity", overallSavingsMs: 900 } },
        "uses-text-compression": { title: "Enable text compression", score: 1, details: { type: "opportunity", overallSavingsMs: 0 } },
        "final-screenshot": { details: { type: "screenshot", data: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==" } },
      },
    },
  };
}
