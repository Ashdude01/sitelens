"use client";

import { useSyncExternalStore } from "react";

/** Renders children only when the media query matches, so a widget that fetches data mounts once (sidebar OR inline). */
export function MediaSlot({ query, children }: { query: string; children: React.ReactNode }) {
  const matches = useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
  return matches ? <>{children}</> : null;
}
