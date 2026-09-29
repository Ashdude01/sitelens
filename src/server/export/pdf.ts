// One-page PDF report with the share card, key numbers, tech stack, health grades and a clickable backlink.
import { PDFDocument, PDFName, PDFString, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { CachedReport } from "@/lib/types";
import { computeEstimates } from "@/lib/estimates";
import { summarize } from "@/lib/estimates/summary";
import type { CardData } from "./card-data";

// Standard PDF fonts only cover WinAnsi; replace anything else so text never fails to encode.
const safe = (s: string) =>
  s
    .replace(/[‒-―]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7e\xa0-\xff]/g, "");

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = safe(text).split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > width && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

function addLink(pdf: PDFDocument, page: PDFPage, url: string, x: number, y: number, w: number, h: number) {
  const annot = pdf.context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: [x, y, x + w, y + h],
    Border: [0, 0, 0],
    A: { Type: "Action", S: "URI", URI: PDFString.of(url) },
  });
  page.node.set(PDFName.of("Annots"), pdf.context.obj([pdf.context.register(annot)]));
}

export async function renderPdf(report: CachedReport, card: CardData, cardPng: ArrayBuffer): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${card.domain}: traffic & tech stack report`);
  pdf.setAuthor(card.siteName);
  pdf.setSubject(card.reportUrl);
  const page = pdf.addPage([595.28, 841.89]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.07, 0.09, 0.15);
  const muted = rgb(0.42, 0.45, 0.5);
  const brand = rgb(0.16, 0.47, 0.84);
  const M = 40;
  const W = page.getWidth() - 2 * M;
  let y = page.getHeight() - M;

  const text = (s: string, opts: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb>; x?: number } = {}) => {
    const size = opts.size ?? 10;
    page.drawText(safe(s), { x: opts.x ?? M, y: y - size, size, font: opts.f ?? font, color: opts.color ?? ink });
    y -= size + 4;
  };

  // Card image
  const img = await pdf.embedPng(cardPng);
  const h = (W * img.height) / img.width;
  page.drawImage(img, { x: M, y: y - h, width: W, height: h });
  addLink(pdf, page, card.reportUrl, M, y - h, W, h);
  y -= h + 18;

  // Summary
  text("Summary", { size: 13, f: bold });
  for (const line of wrap(summarize(report, computeEstimates(report)), font, 10, W)) text(line, { color: muted });
  y -= 8;

  // Key numbers table
  text("Key numbers", { size: 13, f: bold });
  const rows: [string, string][] = [
    ["Monthly visits", card.visits ? `${card.visits.value}${card.visits.range ? `  (${card.visits.range})` : ""}` : "Not enough data"],
    [card.revenue?.label ?? "Ad revenue / mo", card.revenue ? `${card.revenue.value}  (${card.revenue.range})` : "n/a"],
    ["Estimated worth", card.worth ? `${card.worth.value}  (${card.worth.range})` : "n/a"],
    ["Popularity rank", card.rank ?? "n/a"],
    ["Site type", card.siteType],
    ["Confidence", card.confidence ?? "n/a"],
  ];
  for (const [k, v] of rows) {
    page.drawText(safe(k), { x: M, y: y - 10, size: 10, font, color: muted });
    page.drawText(safe(v), { x: M + 150, y: y - 10, size: 10, font: bold, color: ink });
    y -= 16;
  }
  y -= 8;

  // Technologies
  text("Technology stack", { size: 13, f: bold });
  const techs = report.technologies.filter((t) => t.confidence >= 50).map((t) => (t.version ? `${t.name} ${t.version}` : t.name));
  for (const line of wrap(techs.join("  ·  "), font, 10, W).slice(0, 6)) text(line);
  y -= 8;

  if (card.grades.length) {
    text("Health grades", { size: 13, f: bold });
    text(card.grades.map((g) => `${g.label}: ${g.grade} (${g.score}/100)`).join("     "));
    y -= 8;
  }

  // Footer with backlink
  const footY = M;
  page.drawLine({ start: { x: M, y: footY + 26 }, end: { x: M + W, y: footY + 26 }, thickness: 0.5, color: rgb(0.88, 0.89, 0.91) });
  page.drawText(safe(`Generated ${new Date().toISOString().slice(0, 10)} by ${card.siteName}. Traffic, earnings and worth are estimates.`), {
    x: M,
    y: footY + 12,
    size: 8,
    font,
    color: muted,
  });
  const linkText = safe(`Full live report: ${card.reportUrl}`);
  page.drawText(linkText, { x: M, y: footY, size: 9, font: bold, color: brand });
  addLink(pdf, page, card.reportUrl, M, footY - 2, bold.widthOfTextAtSize(linkText, 9), 12);

  return pdf.save({ useObjectStreams: false });
}
