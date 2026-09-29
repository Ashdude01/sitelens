import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import type { SiteCard as SiteCardData } from "@/server/repositories/reports";
import { compact } from "@/lib/format";
import { Favicon } from "@/components/report/favicon";
import { TechIcon } from "@/components/report/tech-icon";

export function SiteCard({ site }: { site: SiteCardData }) {
  return (
    <Link
      href={`/site/${encodeURIComponent(site.domain)}`}
      className="bg-card hover:border-primary/40 group flex min-w-0 flex-col gap-3 rounded-xl border p-4 transition-colors hover:shadow-sm"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="bg-background grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg border">
          <Favicon src={site.favicon} />
        </div>
        <div className="min-w-0">
          <p className="group-hover:text-primary truncate font-medium">{site.domain}</p>
          <p className="text-muted-foreground truncate text-xs">{site.title ?? " "}</p>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between gap-2">
        <div className="flex items-center -space-x-1">
          {site.techs.map((t) => (
            <span key={t.name} title={t.name} className="bg-background grid size-6 place-items-center rounded-full border">
              <TechIcon name={t.name} icon={t.icon} className="size-3.5" />
            </span>
          ))}
        </div>
        <span className="text-muted-foreground flex items-center gap-1 text-xs tabular-nums">
          {site.monthlyVisits ? (
            <>
              {site.verified && <BadgeCheck className="text-success size-3.5" />}~{compact(site.monthlyVisits)} visits/mo
            </>
          ) : (
            "Traffic unknown"
          )}
        </span>
      </div>
    </Link>
  );
}

export function SiteCardGrid({ sites }: { sites: SiteCardData[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {sites.map((s) => (
        <SiteCard key={s.domain} site={s} />
      ))}
    </div>
  );
}
