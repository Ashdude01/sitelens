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

export function InfraCard({ report: r, className }: { report: Report; className?: string }) {
  const h = r.hosting;
  const c = r.cert;
  const reg = r.registration;
  const rows: [React.ReactNode, React.ReactNode][] = [
    ["IP address", h.ip ? <span className="font-mono text-xs">{h.ip}{h.ipv6 && <span className="text-muted-foreground"> · IPv6</span>}</span> : <Dash />],
    ["Hosting network", h.asn ? `${h.asn.org ?? "Unknown"} (AS${h.asn.asn}${h.asn.country ? `, ${h.asn.country}` : ""})` : <Dash />],
    ["Nameservers", lines(h.nameservers, 4)],
    ["Mail servers", lines(h.mx, 3)],
    ["SPF", h.spf ? "Configured" : <Dash />],
    ["DMARC", h.dmarc ? (h.dmarc.match(/p=\w+/)?.[0] ?? "Configured") : <Dash />],
    [
      "SSL issuer",
      c ? (
        <span>
          {c.issuerOrg ?? c.issuerCN ?? "—"}{" "}
          {!c.trusted && (
            <Badge variant="destructive" className="ml-1">
              not trusted
            </Badge>
          )}
        </span>
      ) : (
        <Dash />
      ),
    ],
    ["SSL expires", c?.validTo ? isoDate(c.validTo) : <Dash />],
    ["TLS", c?.protocol ?? <Dash />],
    ["Domain registered", reg?.registered ? `${isoDate(reg.registered)} (${yearsSince(reg.registered)} yrs)` : <Dash />],
    ["Registrar", reg?.registrar ?? <Dash />],
  ];
  if (h.verificationTxt.length) rows.push(["Verified with", h.verificationTxt.join(", ")]);
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="text-muted-foreground size-4" /> Hosting, DNS &amp; SSL
        </CardTitle>
      </CardHeader>
      <CardContent>
        <KV rows={rows} />
      </CardContent>
    </Card>
  );
}
