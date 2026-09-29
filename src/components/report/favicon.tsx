"use client";

import { useEffect, useRef, useState } from "react";
import { FileSearch } from "lucide-react";

/** Remote favicon of the scanned site, falling back to an icon if it's missing or broken. */
export function Favicon({ src }: { src?: string | null }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // An image can fail before React hydrates (so onError never fires); check once on mount.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [src]);
  if (!src || failed) return <FileSearch className="text-muted-foreground size-5" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary third-party URL, not worth optimizing
    <img ref={ref} src={src} alt="" width={28} height={28} loading="lazy" referrerPolicy="no-referrer" className="size-7" onError={() => setFailed(true)} />
  );
}
