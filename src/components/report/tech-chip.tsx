"use client";

import { Link } from "@/i18n/navigation";
import { Info } from "lucide-react";
import type { Technology } from "@/lib/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { TechIcon } from "./tech-icon";

/** A technology chip: the name opens its page, the (i) button shows why we detected it on this site. */
export function TechChip({ tech }: { tech: Technology }) {
  const t = useTranslations("tech");
  const weak = tech.confidence < 50;
  const href = tech.slug ? `/technology/${tech.slug}` : null;
  const inner = (
    <>
      <TechIcon name={tech.name} icon={tech.icon} />
      <span className="truncate font-medium">{tech.name}</span>
      {tech.version && <span className="text-muted-foreground text-xs tabular-nums">{tech.version}</span>}
      {tech.confidence < 100 && <span className="text-muted-foreground text-xs tabular-nums">{tech.confidence}%</span>}
    </>
  );
  return (
    <span className={cn("bg-secondary inline-flex max-w-full items-center rounded-md text-sm", weak && "opacity-60")}>
      {href ? (
        <Link href={href} className="hover:bg-accent hover:text-accent-foreground inline-flex min-w-0 items-center gap-1.5 rounded-l-md py-1 pr-1.5 pl-2.5 transition-colors">
          {inner}
        </Link>
      ) : (
        <span className="inline-flex min-w-0 items-center gap-1.5 py-1 pr-1.5 pl-2.5">{inner}</span>
      )}
      <Popover>
        <PopoverTrigger
          aria-label={t("whyAria", { name: tech.name })}
          className="text-muted-foreground hover:text-foreground hover:bg-accent data-[state=open]:bg-accent grid h-full place-items-center self-stretch rounded-r-md px-1.5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Info className="size-3.5" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 text-sm">
          <div className="space-y-3">
            <div>
              <p className="flex items-center gap-2 font-medium">
                <TechIcon name={tech.name} icon={tech.icon} className="size-5" />
                {tech.name} {tech.version && <span className="text-muted-foreground font-normal">{tech.version}</span>}
              </p>
              <p className="text-muted-foreground text-xs">
                {tech.categories.join(" · ")} · {t("confidence", { n: tech.confidence })}
                {tech.implied ? ` · ${t("implied")}` : ""}
              </p>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium">{t("whyHere")}</p>
              <ul className="space-y-1">
                {tech.evidence.map((e) => (
                  <li key={e} className="bg-muted rounded px-2 py-1 font-mono text-[11px] leading-snug break-all">
                    {e}
                  </li>
                ))}
              </ul>
            </div>
            {href && (
              <Link href={href} className="text-primary text-xs hover:underline">
                {t("about", { name: tech.name })}
              </Link>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </span>
  );
}
