import type { Report } from "@/lib/types";
import { compact } from "@/lib/format";
import type { Estimates } from "./index";

const money = (n: number) => (n >= 1000 ? `$${compact(n)}` : `$${n < 10 ? n.toFixed(1) : Math.round(n)}`);

/** One plain-English paragraph that sums up the report. */
export function summarize(r: Report, e: Estimates): string {
  const parts: string[] = [];
  // Headline technologies: skip implied ones and add-ons of an already-listed product ("WordPress Block Editor").
  const main: string[] = [];
  for (const t of r.technologies) {
    if (t.confidence < 50 || t.implied || t.priority > 3) continue;
    if (main.some((m) => t.name.startsWith(m) || m.startsWith(t.name))) continue;
    main.push(t.name);
    if (main.length === 3) break;
  }
  const host = r.hosting.asn?.org?.split(/[,-]/)[0]?.trim();
  let first = `${r.domain} looks like ${/^[aeiou]/i.test(e.siteType.label) ? "an" : "a"} ${e.siteType.label.toLowerCase()}`;
  if (main.length) first += ` built with ${main.join(", ")}`;
  if (host) first += `, hosted on ${host}`;
  parts.push(`${first}.`);

  if (e.visits) {
    const v = e.visits.monthly;
    let t = e.verified
      ? `It gets ${compact(v.mid)} visits a month (verified by the owner)`
      : `We estimate ${compact(v.low)}–${compact(v.high)} visits a month`;
    if (e.countries[0]) t += `, most likely led by ${e.countries[0].name}`;
    parts.push(`${t}.`);
    if (e.earnings) {
      const m = e.earnings.monthly;
      parts.push(
        e.earnings.kind === "estimated"
          ? `With ${e.earnings.adNetworks.slice(0, 2).join(" and ")} on the page, display ads could bring in roughly ${money(m.low)}–${money(m.high)} a month.`
          : `We found no ad network, so it probably earns in other ways; display ads could bring in roughly ${money(m.low)}–${money(m.high)} a month.`,
      );
    }
  } else {
    parts.push("It is not in any popularity list we track yet, so it is probably small or new.");
  }
  if (r.registration?.registered) {
    const yrs = (Date.now() - new Date(r.registration.registered).getTime()) / 3.156e10;
    if (yrs >= 1) parts.push(`The domain is ${Math.floor(yrs)} years old.`);
  }
  return parts.join(" ");
}
