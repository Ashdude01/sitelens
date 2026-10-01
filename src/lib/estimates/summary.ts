import type { Report } from "@/lib/types";
import { compact } from "@/lib/format";
import en from "../../../messages/en.json";
import { countryName } from "./index";
import type { Estimates } from "./index";

type TFn = (key: string, values?: Record<string, string | number>) => string;

function english(key: string, values?: Record<string, string | number>) {
  const parts = key.split(".");
  let cur: unknown = en;
  for (const part of parts) cur = (cur as Record<string, unknown> | undefined)?.[part];
  if (typeof cur !== "string") return key;
  return cur.replace(/\{(\w+)\}/g, (_, k) => String(values?.[k] ?? ""));
}

/** One short line for the report overview. */
export function summarize(r: Report, e: Estimates, t: TFn = english, locale = "en"): string {
  const parts: string[] = [];
  const main: string[] = [];
  for (const tech of r.technologies) {
    if (tech.confidence < 50 || tech.implied || tech.priority > 3) continue;
    if (main.some((m) => tech.name.startsWith(m) || m.startsWith(tech.name))) continue;
    main.push(tech.name);
    if (main.length === 3) break;
  }
  const host = r.hosting.asn?.org?.split(/[,-]/)[0]?.trim();
  const type = t(`siteType.${e.siteType.id}`);
  const values = { domain: r.domain, type, tech: main.join(", "), host: host ?? "" };
  const key = main.length && host ? "summary.both" : main.length ? "summary.tech" : host ? "summary.host" : "summary.base";
  parts.push(t(key, values));

  if (e.visits) {
    const v = e.visits.monthly;
    const country = e.countries[0] ? countryName(e.countries[0].code, locale) : "";
    if (e.verified) {
      parts.push(country ? t("summary.visitsVC", { n: compact(v.mid), country }) : t("summary.visitsV", { n: compact(v.mid) }));
    } else {
      const range = { low: compact(v.low), high: compact(v.high), country };
      parts.push(country ? t("summary.visitsEC", range) : t("summary.visitsE", range));
    }
  } else {
    parts.push(t("summary.none"));
  }
  return parts.join(" ");
}
