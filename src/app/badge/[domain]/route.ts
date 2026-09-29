import { config } from "@/server/config";
import { InputError, getReport, normalizeTarget } from "@/server/services/report-service";
import { buildCardData } from "@/server/export/card-data";
import { renderBadge } from "@/server/export/badge";

/**
 * Live SVG badge for site owners: /badge/example.com.svg?metric=traffic|stack|grade
 * Always wrapped in a link to the report by the embed code, so every badge is a backlink.
 */
export async function GET(req: Request, ctx: RouteContext<"/badge/[domain]">) {
  const raw = decodeURIComponent((await ctx.params).domain).replace(/\.svg$/i, "");
  const metric = new URL(req.url).searchParams.get("metric") ?? "traffic";
  let key: string;
  try {
    key = normalizeTarget(raw).key;
  } catch (e) {
    return new Response(e instanceof InputError ? e.message : "Bad domain", { status: 400 });
  }
  const report = await getReport(key);
  let label = config.siteName;
  let value = "not analyzed";
  let color = "#9ca3af";
  if (report) {
    const d = buildCardData(report);
    if (metric === "stack") {
      label = "built with";
      value = d.techs.slice(0, 2).join(" + ") || "unknown";
      color = "#2a78d6";
    } else if (metric === "grade") {
      const sec = d.grades.find((g) => g.label === "Security");
      label = "security";
      value = sec ? `${sec.grade} · ${sec.score}/100` : "n/a";
      color = sec && ["A", "B"].includes(sec.grade) ? "#15803d" : sec?.grade === "C" ? "#b45309" : "#b91c1c";
    } else {
      label = `${config.siteName} traffic`;
      value = d.visits ? `${d.visits.value} visits/mo${d.visits.verified ? " ✓" : ""}` : "not enough data";
      color = d.visits ? "#2a78d6" : "#9ca3af";
    }
  }
  return new Response(renderBadge(label, value, color), {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=21600",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
      "access-control-allow-origin": "*",
    },
  });
}
