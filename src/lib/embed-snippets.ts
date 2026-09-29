// Embed code users paste on their own site. Every snippet links back to the report (the backlink).
import type { CardData } from "@/server/export/card-data";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function badgeSnippet(publicUrl: string, d: CardData, metric: "traffic" | "stack" | "grade" = "traffic") {
  const src = `${publicUrl}/badge/${encodeURIComponent(d.domain)}.svg${metric === "traffic" ? "" : `?metric=${metric}`}`;
  return `<a href="${esc(d.reportUrl)}" title="${esc(d.domain)} traffic and tech stack on ${esc(d.siteName)}"><img src="${esc(src)}" alt="${esc(d.domain)} stats by ${esc(d.siteName)}" height="20"></a>`;
}

export function imageCardSnippet(publicUrl: string, d: CardData) {
  const src = `${publicUrl}/api/v1/card/${encodeURIComponent(d.domain)}?size=small`;
  return `<a href="${esc(d.reportUrl)}" title="${esc(d.domain)} website report on ${esc(d.siteName)}"><img src="${esc(src)}" alt="${esc(d.domain)} traffic, earnings and tech stack by ${esc(d.siteName)}" width="600" height="315" loading="lazy" style="max-width:100%;height:auto;border-radius:12px"></a>`;
}

/** Self-contained HTML card (inline styles, no scripts). Values are a snapshot from the latest scan. */
export function htmlCardSnippet(d: CardData) {
  const stat = (label: string, value: string) =>
    `<div style="flex:1;min-width:110px;background:#f3f4f6;border-radius:10px;padding:10px 12px"><div style="font-size:12px;color:#6b7280">${esc(label)}</div><div style="font-size:18px;font-weight:600;color:#111827">${esc(value)}</div></div>`;
  const techs = d.techs
    .slice(0, 6)
    .map((t) => `<span style="display:inline-block;margin:0 6px 6px 0;padding:3px 8px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px;color:#374151">${esc(t)}</span>`)
    .join("");
  return `<!-- ${esc(d.siteName)} website card for ${esc(d.domain)} -->
<div style="max-width:520px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;border:1px solid #e5e7eb;border-radius:14px;padding:16px;background:#fff;color:#111827">
  <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
    <div style="font-size:18px;font-weight:600">${esc(d.domain)}</div>
    <div style="font-size:12px;color:#6b7280">${esc(d.siteType)}</div>
  </div>
  <div style="display:flex;flex-wrap:wrap;gap:8px;margin:12px 0">
    ${stat("Monthly visits", d.visits?.value ?? "n/a")}
    ${stat(d.revenue?.label ?? "Ad revenue / mo", d.revenue?.value ?? "n/a")}
    ${stat("Estimated worth", d.worth?.value ?? "n/a")}
  </div>
  <div>${techs}</div>
  <div style="margin-top:8px;font-size:12px;color:#6b7280">Estimates by <a href="${esc(d.reportUrl)}" style="color:#2a78d6;text-decoration:none;font-weight:600">${esc(d.siteName)}: ${esc(d.domain)} report</a></div>
</div>`;
}
