"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Official technology logo (served from our own /tech-icons route), with a letter fallback. */
export function TechIcon({ name, icon, className }: { name: string; icon?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [icon]);
  if (!icon || failed) {
    return (
      <span
        aria-hidden
        className={cn("bg-muted text-muted-foreground grid size-4 shrink-0 place-items-center rounded-[4px] text-[9px] font-semibold uppercase", className)}
      >
        {name.replace(/[^a-z0-9]/gi, "").slice(0, 1) || "?"}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small logos from our own cached route
    <img
      ref={ref}
      src={`/tech-icons/${encodeURIComponent(icon)}`}
      alt=""
      width={16}
      height={16}
      loading="lazy"
      className={cn("size-4 shrink-0 object-contain", className)}
      onError={() => setFailed(true)}
    />
  );
}
