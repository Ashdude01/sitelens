import { Globe } from "lucide-react";
import type { Report } from "@/lib/types";
import { fmt } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dash, KV } from "./kv";

export function WebsiteCard({ report: r, className }: { report: Report; className?: string }) {
  const s = r.site;
  const f = r.fetch;
  const rows: [React.ReactNode, React.ReactNode][] = [];
  if (f.status !== undefined) {
    rows.push(["HTTP status", `${f.status}${f.redirects ? ` after ${f.redirects} redirect${f.redirects > 1 ? "s" : ""}` : ""}`]);
    rows.push(["Response time", `${fmt(f.responseMs)} ms`]);
    rows.push(["HTML size", `${fmt(Math.round(f.bytes / 1024))} KB`]);
  } else {
    rows.push(["Homepage", <span key="e" className="text-destructive">Could not fetch ({f.error})</span>]);
  }
  if (s) {
    rows.push(["Language", s.language ?? <Dash />]);
    rows.push(["Links on homepage", `${fmt(s.links.internal)} internal · ${fmt(s.links.external)} external`]);
    if (s.structuredData.length) rows.push(["Structured data", s.structuredData.join(", ")]);
    const social = Object.entries(s.social);
    if (social.length)
      rows.push([
        "Social profiles",
        <span key="s" className="flex flex-wrap gap-x-3">
          {social.map(([k, u]) => (
            <a key={k} href={u} target="_blank" rel="nofollow noopener noreferrer" className="text-primary hover:underline">
              {k}
            </a>
          ))}
        </span>,
      ]);
    rows.push(["Images without alt", `${fmt(s.images.missingAlt)} of ${fmt(s.images.total)}`]);
  }
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="text-muted-foreground size-4" /> Website
        </CardTitle>
      </CardHeader>
      <CardContent>
        <KV rows={rows} />
      </CardContent>
    </Card>
  );
}
