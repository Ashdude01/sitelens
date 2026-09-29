"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Bust browsers that cached the old sandboxed SVG for 30 days. */
const ICON_REV = "2";

/** Official technology logo (served from our own /tech-icons route), with a letter fallback. */
export function TechIcon({ name, icon, className }: { name: string; icon?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const letter = name.replace(/[^a-z0-9]/gi, "").slice(0, 1) || "?";
  if (!icon || failed) {
    return (
      <span
        aria-hidden
        className={cn("bg-muted text-muted-foreground grid size-4 shrink-0 place-items-center rounded-[4px] text-[9px] font-semibold uppercase", className)}
      >
        {letter}
      </span>
    );
  }
  return (
    <span className={cn("grid size-4 shrink-0 place-items-center overflow-hidden rounded-[3px] bg-white", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- small logos from our own cached route */}
      <img
        src={`/tech-icons/${encodeURIComponent(icon)}?v=${ICON_REV}`}
        alt=""
        width={32}
        height={32}
        className="size-[82%] object-contain"
        onLoad={(e) => {
          if (e.currentTarget.naturalWidth === 0) setFailed(true);
        }}
        onError={() => setFailed(true)}
      />
    </span>
  );
}
