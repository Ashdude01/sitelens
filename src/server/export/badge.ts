// Shields-style SVG badge. Width is estimated from character widths (Verdana 11px metrics, like shields.io).
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const textWidth = (s: string) => [...s].reduce((w, ch) => w + (/[A-Z0-9MW@#%]/.test(ch) ? 7.5 : /[il.,:;|!' ]/.test(ch) ? 3.6 : 6.4), 0);

export function renderBadge(label: string, value: string, color = "#2a78d6"): string {
  const lw = Math.round(textWidth(label) + 16);
  const vw = Math.round(textWidth(value) + 16);
  const w = lw + vw;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${esc(label)}: ${esc(value)}">
<title>${esc(label)}: ${esc(value)}</title>
<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
<clipPath id="r"><rect width="${w}" height="20" rx="3" fill="#fff"/></clipPath>
<g clip-path="url(#r)"><rect width="${lw}" height="20" fill="#555"/><rect x="${lw}" width="${vw}" height="20" fill="${color}"/><rect width="${w}" height="20" fill="url(#s)"/></g>
<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
<text x="${lw / 2}" y="14" fill="#010101" fill-opacity=".3">${esc(label)}</text><text x="${lw / 2}" y="13">${esc(label)}</text>
<text x="${lw + vw / 2}" y="14" fill="#010101" fill-opacity=".3">${esc(value)}</text><text x="${lw + vw / 2}" y="13">${esc(value)}</text>
</g></svg>`;
}
