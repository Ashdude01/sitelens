import { getTranslations } from "next-intl/server";
import { Globe } from "lucide-react";
import type { Report } from "@/lib/types";
import { fmt } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dash, KV } from "./kv";

export async function WebsiteCard({ report: r, className }: { report: Report; className?: string }) {
  const t = await getTranslations("website");
  const s = r.site;
  const f = r.fetch;
  const rows: [React.ReactNode, React.ReactNode][] = [];
  if (f.status !== undefined) {
    const redirect =
      f.redirects === 1 ? ` ${t("afterRedirect", { n: f.redirects })}` : f.redirects > 1 ? ` ${t("afterRedirects", { n: f.redirects })}` : "";
    rows.push([t("status"), `${f.status}${redirect}`]);
    rows.push([t("response"), `${fmt(f.responseMs)} ms`]);
    rows.push([t("size"), `${fmt(Math.round(f.bytes / 1024))} KB`]);
  } else {
    rows.push([t("home"), <span key="e" className="text-destructive">{t("fetchFail", { error: f.error ?? "" })}</span>]);
  }
  if (s) {
    rows.push([t("language"), s.language ?? <Dash />]);
    rows.push([t("links"), t("linksValue", { internal: fmt(s.links.internal), external: fmt(s.links.external) })]);
    if (s.structuredData.length) rows.push([t("structured"), s.structuredData.join(", ")]);
    const social = Object.entries(s.social);
    if (social.length)
      rows.push([
        t("social"),
        <span key="s" className="flex flex-wrap gap-x-3">
          {social.map(([k, u]) => (
            <a key={k} href={u} target="_blank" rel="nofollow noopener noreferrer" className="text-primary hover:underline">
              {k}
            </a>
          ))}
        </span>,
      ]);
    rows.push([t("alt"), t("altValue", { missing: fmt(s.images.missingAlt), total: fmt(s.images.total) })]);
  }
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="text-muted-foreground size-4" /> {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <KV rows={rows} />
      </CardContent>
    </Card>
  );
}
