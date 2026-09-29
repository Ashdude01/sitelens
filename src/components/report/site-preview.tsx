"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Homepage preview. Width matches the previous sidebar (340px). */
export function SitePreview({ domain, className }: { domain: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  return (
    <figure className={cn("bg-card w-full max-w-[340px] shrink-0 overflow-hidden rounded-xl border", className)}>
      <div className="bg-muted relative aspect-[16/10]">
        {!failed && (
          // eslint-disable-next-line @next/next/no-img-element -- screenshot is a dynamic image from our own preview route
          <img
            src={`/api/v1/preview?domain=${encodeURIComponent(domain)}`}
            alt={`Homepage of ${domain}`}
            className="size-full object-cover object-top"
            onLoad={() => setReady(true)}
            onError={() => setFailed(true)}
          />
        )}
        {!ready && !failed && <Skeleton className="absolute inset-0 rounded-none" />}
        {failed && <div className="text-muted-foreground absolute inset-0 grid place-items-center px-4 text-center text-xs">Preview unavailable</div>}
      </div>
      <figcaption className="text-muted-foreground truncate px-3 py-2 text-[11px]">{domain}</figcaption>
    </figure>
  );
}
