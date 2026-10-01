import { getTranslations } from "next-intl/server";
import { Server } from "lucide-react";
import type { Report } from "@/lib/types";
import { isoDate, yearsSince } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dash, KV } from "./kv";

const lines = (xs: string[], n: number) =>
  xs.length ? (
    <span className="flex flex-col font-mono text-xs">
      {xs.slice(0, n).map((x) => (
        <span key={x} className="truncate">
          {x}
        </span>
      ))}
    </span>
  ) : (
    <Dash />
  );

export async function InfraCard({ report: r, className }: { report: Report; className?: string }) {
  const t = await getTranslations("infra");
  const h = r.hosting;
  const c = r.cert;
  const reg = r.registration;
  const rows: [React.ReactNode, React.ReactNode][] = [
    ["IP address", h.ip ? <span className="font-mono text-xs">{h.ip}{h.ipv6 && <span className="text-muted-foreground"> · IPv6</span>}</span> : <Dash />],
    [t("network"), h.asn ? `${h.asn.org ?? t("unknown")} (AS${h.asn.asn}${h.asn.country ? `, ${h.asn.country}` : ""})` : <Dash />],
    [t("ns"), lines(h.nameservers, 4)],
    [t("mx"), lines(h.mx, 3)],
    [t("spf"), h.spf ? t("configured") : <Dash />],
    [t("dmarc"), h.dmarc ? (h.dmarc.match(/p=\w+/)?.[0] ?? t("configured")) : <Dash />],
    [
      t("issuer"),
      c ? (
        <span>
          {c.issuerOrg ?? c.issuerCN ?? "—"}{" "}
          {!c.trusted && (
            <Badge variant="destructive" className="ml-1">
              {t("untrusted")}
            </Badge>
          )}
        </span>
      ) : (
        <Dash />
      ),
    ],
    [t("expires"), c?.validTo ? isoDate(c.validTo) : <Dash />],
    [t("tls"), c?.protocol ?? <Dash />],
    [t("registered"), reg?.registered ? t("years", { date: isoDate(reg.registered), n: yearsSince(reg.registered) ?? "" }) : <Dash />],
    [t("registrar"), reg?.registrar ?? <Dash />],
  ];
  if (h.verificationTxt.length) rows.push([t("verified"), h.verificationTxt.join(", ")]);
  rows[0][0] = t("ip");
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="text-muted-foreground size-4" /> {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <KV rows={rows} />
      </CardContent>
    </Card>
  );
}
