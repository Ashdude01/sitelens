"use client";

import { useLocale, useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { LOCALES, localeMeta, type Locale } from "@/i18n/locales";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function Flag({ code }: { code: Locale }) {
  const meta = localeMeta(code);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- country flag webp
    <img src={`https://flagcdn.com/w40/${meta.flag}.webp`} alt="" width={20} height={15} className="h-[15px] w-5 shrink-0 rounded-[2px] object-cover" />
  );
}

export function LanguageSwitcher() {
  const t = useTranslations("footer");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const current = localeMeta(locale);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2 px-2">
          <Flag code={current.code} />
          <span className="max-w-28 truncate">{current.label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-[min(24rem,calc(100vw-2rem))] p-3">
        <p className="text-muted-foreground mb-2 px-1 text-[11px] font-semibold tracking-wide uppercase">{t("language")}</p>
        <ul className="grid grid-cols-2 gap-1">
          {LOCALES.map((item, i) => (
            <li key={item.code} className={i === LOCALES.length - 1 ? "col-span-2 flex justify-center" : undefined}>
              <Link
                href={pathname}
                locale={item.code}
                hrefLang={item.intl}
                data-same-tab=""
                className={cn(
                  "hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left",
                  i === LOCALES.length - 1 && "max-w-[50%]",
                  item.code === locale && "bg-muted",
                )}
              >
                <Flag code={item.code} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium leading-tight">{item.label}</span>
                  <span className="text-muted-foreground block truncate text-[11px] leading-tight">{item.region}</span>
                </span>
                {item.code === locale && <Check className="size-4 shrink-0" />}
              </Link>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
