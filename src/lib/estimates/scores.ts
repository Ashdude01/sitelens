// Simple, explainable site-health scores built only from what the scan observed.
import type { Report } from "@/lib/types";

export interface Check {
  label: string;
  pass: boolean;
  /** One-line advice shown when the check fails. */
  tip: string;
  weight: number;
}

export interface Score {
  id: "security" | "seo" | "performance";
  label: string;
  score: number; // 0–100
  grade: "A" | "B" | "C" | "D" | "F";
  checks: Check[];
}

const grade = (s: number): Score["grade"] => (s >= 90 ? "A" : s >= 75 ? "B" : s >= 60 ? "C" : s >= 40 ? "D" : "F");

function build(id: Score["id"], label: string, checks: Check[]): Score {
  const total = checks.reduce((s, c) => s + c.weight, 0);
  const got = checks.reduce((s, c) => s + (c.pass ? c.weight : 0), 0);
  const score = total ? Math.round((got / total) * 100) : 0;
  return { id, label, score, grade: grade(score), checks };
}

export function computeScores(r: Report): Score[] | null {
  if (!r.fetch.ok || !r.site) return null;
  const s = r.site;
  const sec = r.security;
  const h = r.hosting;
  const f = r.fetch;
  const certDays = r.cert?.validTo ? (new Date(r.cert.validTo).getTime() - Date.now()) / 86_400_000 : null;
  const titleLen = s.title?.length ?? 0;
  const descLen = s.description?.length ?? 0;

  const security = build("security", "Security", [
    { label: "Served over HTTPS", pass: !!sec?.https, tip: "Redirect all traffic to HTTPS.", weight: 3 },
    { label: "Valid, trusted SSL certificate", pass: !!r.cert?.trusted, tip: "Install a certificate from a trusted CA.", weight: 3 },
    { label: "Certificate not expiring within 14 days", pass: certDays !== null && certDays > 14, tip: "Renew the certificate or enable auto-renew.", weight: 1 },
    { label: "HSTS header", pass: !!sec?.hsts, tip: "Add Strict-Transport-Security.", weight: 1 },
    { label: "Content-Security-Policy header", pass: !!sec?.csp, tip: "Add a CSP to limit script sources.", weight: 1 },
    { label: "Clickjacking protection", pass: !!sec?.xFrameOptions, tip: "Add X-Frame-Options or CSP frame-ancestors.", weight: 1 },
    { label: "SPF email record", pass: !!h.spf, tip: "Publish an SPF record so others can't spoof your email.", weight: 1 },
    { label: "DMARC email policy", pass: !!h.dmarc, tip: "Publish a DMARC record.", weight: 1 },
  ]);

  const seo = build("seo", "SEO basics", [
    { label: "Title tag 10–65 characters", pass: titleLen >= 10 && titleLen <= 65, tip: `Title is ${titleLen} characters.`, weight: 2 },
    { label: "Meta description 50–160 characters", pass: descLen >= 50 && descLen <= 160, tip: descLen ? `Description is ${descLen} characters.` : "Add a meta description.", weight: 2 },
    { label: "Exactly one H1 heading", pass: s.headings.h1 === 1, tip: `Found ${s.headings.h1} H1 headings.`, weight: 1 },
    { label: "Language declared", pass: !!s.language, tip: 'Add lang="…" to the <html> tag.', weight: 1 },
    { label: "Canonical URL", pass: !!s.canonical, tip: "Add a rel=canonical link.", weight: 1 },
    { label: "Structured data (JSON-LD)", pass: s.structuredData.length > 0, tip: "Add schema.org markup for rich results.", weight: 1 },
    { label: "Social preview image (og:image)", pass: !!s.ogImage, tip: "Add an og:image for link previews.", weight: 1 },
    { label: "Images have alt text", pass: s.images.total === 0 || s.images.missingAlt / s.images.total < 0.2, tip: `${s.images.missingAlt} of ${s.images.total} images lack alt text.`, weight: 1 },
    { label: "Sitemap listed in robots.txt", pass: !!r.robots.sitemaps?.length, tip: "Reference your sitemap in robots.txt.", weight: 1 },
    { label: "Not blocked by meta robots", pass: !/noindex/i.test(s.robotsMeta ?? ""), tip: "The homepage has noindex.", weight: 2 },
  ]);

  const perfChecks: Check[] = [];
  if (f.status !== undefined) {
    perfChecks.push(
      { label: "Server responds in under 800 ms", pass: f.responseMs < 800, tip: `Took ${f.responseMs} ms (including redirects).`, weight: 2 },
      { label: "HTML under 150 KB", pass: f.bytes < 150 * 1024, tip: `HTML is ${Math.round(f.bytes / 1024)} KB.`, weight: 1 },
      { label: "Compression enabled", pass: !!sec?.compression, tip: "Enable gzip or Brotli.", weight: 1 },
      { label: "No more than one redirect", pass: f.redirects <= 1, tip: `${f.redirects} redirects before the page loads.`, weight: 1 },
    );
  }
  const cwv = r.traffic.crux?.inCrux ? r.traffic.crux.coreWebVitals : null;
  if (cwv?.lcpMs != null) perfChecks.push({ label: "LCP under 2.5 s (real users)", pass: cwv.lcpMs <= 2500, tip: `LCP is ${(cwv.lcpMs / 1000).toFixed(1)} s.`, weight: 2 });
  if (cwv?.inpMs != null) perfChecks.push({ label: "INP under 200 ms (real users)", pass: cwv.inpMs <= 200, tip: `INP is ${cwv.inpMs} ms.`, weight: 2 });
  if (cwv?.cls != null) perfChecks.push({ label: "CLS under 0.1 (real users)", pass: Number(cwv.cls) <= 0.1, tip: `CLS is ${cwv.cls}.`, weight: 1 });

  return [security, seo, build("performance", "Performance", perfChecks)];
}
