import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { config } from "@/server/config";

export const metadata: Metadata = {
  title: "API",
  description: "JSON API for website tech stack and traffic estimates.",
};

const FIELDS: [string, string][] = [
  ["technologies[]", "name, version, categories, confidence (0–100), evidence[]"],
  ["traffic", "verdict, estimate { monthlyVisits { low, mid, high }, confidence, calibrated }, ranks[], countries[]"],
  ["hosting", "ip, asn, nameservers, mx, spf, dmarc, verificationTxt"],
  ["cert / registration", "SSL issuer and expiry; domain registration date and registrar"],
  ["site / security", "title, description, language, social profiles, structured data; security headers"],
];

export default function ApiDocsPage() {
  const ex = `${config.publicUrl}/api/v1/lookup?domain=example.com`;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">API</h1>
        <p className="text-muted-foreground">Every report is available as JSON.</p>
        <Card className="py-4">
          <CardContent className="overflow-x-auto font-mono text-sm">
            <p>GET {ex}</p>
            <p className="text-muted-foreground">GET {ex}&amp;refresh=1 &nbsp;# force a fresh scan (rate-limited)</p>
          </CardContent>
        </Card>
        <dl className="divide-y rounded-xl border text-sm">
          {FIELDS.map(([k, v]) => (
            <div key={k} className="grid gap-1 p-3 sm:grid-cols-[180px_1fr]">
              <dt className="font-mono">{k}</dt>
              <dd className="text-muted-foreground">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-muted-foreground text-sm">
          Status codes: 200 OK · 400 invalid domain · 429 rate limit ({config.freshScansPerHour} new scans/hour) · 502 scan failed. Cached reports
          are free. API keys and paid plans come next.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
