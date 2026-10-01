"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export const SECTIONS = [
  { id: "overview" },
  { id: "traffic" },
  { id: "earnings" },
  { id: "technology" },
  { id: "infrastructure" },
  { id: "health" },
] as const;

/** Sticky in-page navigation that highlights the section in view. */
export function SectionNav({ available }: { available: string[] }) {
  const items = SECTIONS.filter((s) => available.includes(s.id));
  const [active, setActive] = useState<string>(items[0]?.id ?? "");
  const t = useTranslations("sections");

  const key = items.map((s) => s.id).join(",");
  useEffect(() => {
    const els = key.split(",").map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-120px 0px -60% 0px" },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [key]);

  return (
    <nav aria-label={t("nav")} className="bg-background/85 sticky top-14 z-30 -mx-4 mb-6 border-b px-4 backdrop-blur">
      <ul className="flex gap-1 overflow-x-auto py-2 [scrollbar-width:none]">
        {items.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              aria-current={active === s.id ? "true" : undefined}
              className={cn(
                "block rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
                active === s.id ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(s.id)}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Section({ id, title, description, children, action }: { id: string; title: string; description?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section id={id} data-section className="mb-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
