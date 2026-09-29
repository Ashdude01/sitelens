// Share card rendered to PNG with next/og (Satori + Resvg). Used for downloads, embeds and Open Graph previews.
import fs from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { config } from "../config";
import type { CardData } from "./card-data";

let fonts: Promise<{ name: string; data: ArrayBuffer; weight: 400 | 600; style: "normal" }[]> | null = null;
function loadFonts() {
  fonts ??= Promise.all(
    ([
      ["Geist-Regular.ttf", 400],
      ["Geist-SemiBold.ttf", 600],
    ] as const).map(async ([file, weight]) => {
      const buf = await fs.readFile(path.join(config.dataDir, "fonts", file));
      return { name: "Geist", data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, weight, style: "normal" as const };
    }),
  );
  return fonts;
}

const C = { bg: "#ffffff", ink: "#111827", muted: "#6b7280", line: "#e5e7eb", soft: "#f3f4f6", brand: "#2a78d6", good: "#15803d", warn: "#b45309", bad: "#b91c1c" };
const gradeColor = (g: string) => (g === "A" || g === "B" ? C.good : g === "C" ? C.warn : C.bad);
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function Stat({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "18px 20px", background: C.soft, borderRadius: 16 }}>
      <div style={{ fontSize: 20, color: C.muted }}>{label}</div>
      <div style={{ fontSize: 44, fontWeight: 600, color: C.ink, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 18, color: C.muted, marginTop: 2 }}>{sub ?? " "}</div>
    </div>
  );
}

export async function renderCardImage(d: CardData, { width = 1200, height = 630 } = {}) {
  const scale = width / 1200;
  const host = config.publicUrl.replace(/^https?:\/\//, "");
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: 1200, height: 630, transform: `scale(${scale})`, transformOrigin: "top left", background: C.bg, fontFamily: "Geist", padding: 48, flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: C.brand, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 24, fontWeight: 600 }}>
              {d.siteName.slice(0, 1)}
            </div>
            <div style={{ fontSize: 26, fontWeight: 600, color: C.ink }}>{d.siteName}</div>
          </div>
          <div style={{ display: "flex", fontSize: 20, color: C.muted, padding: "6px 14px", border: `1px solid ${C.line}`, borderRadius: 999 }}>
            {d.siteType}
            {d.confidence ? ` · ${d.confidence === "Verified" ? "Verified traffic" : `${d.confidence} confidence`}` : ""}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 36 }}>
          <div style={{ fontSize: 64, fontWeight: 600, color: C.ink, letterSpacing: -1.5 }}>{clip(d.domain, 32)}</div>
          <div style={{ fontSize: 24, color: C.muted, marginTop: 6 }}>{clip(d.title ?? "Website traffic & technology report", 80)}</div>
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 32 }}>
          <Stat label="Monthly visits" value={d.visits?.value ?? "n/a"} sub={d.visits?.verified ? "Verified" : d.visits?.range} />
          <Stat label={d.revenue?.label ?? "Ad revenue / mo"} value={d.revenue?.value ?? "n/a"} sub={d.revenue?.range} />
          <Stat label="Estimated worth" value={d.worth?.value ?? "n/a"} sub={d.worth?.range} />
          {d.grades.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "18px 20px", background: C.soft, borderRadius: 16, gap: 6 }}>
              <div style={{ fontSize: 20, color: C.muted }}>Health</div>
              {d.grades.map((g) => (
                <div key={g.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 20, color: C.ink }}>
                  <span>{g.label}</span>
                  <span style={{ fontWeight: 600, color: gradeColor(g.grade) }}>{g.grade}</span>
                </div>
              ))}
            </div>
          ) : (
            <Stat label="Popularity" value={d.rank ?? "n/a"} />
          )}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 28 }}>
          {d.techs.slice(0, 7).map((t) => (
            <div key={t} style={{ display: "flex", fontSize: 20, color: C.ink, padding: "6px 14px", border: `1px solid ${C.line}`, borderRadius: 10 }}>
              {clip(t, 24)}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", marginTop: "auto", justifyContent: "space-between", alignItems: "center", fontSize: 20, color: C.muted, borderTop: `1px solid ${C.line}`, paddingTop: 18 }}>
          <span>Estimates, not the site&apos;s own analytics</span>
          <span style={{ color: C.brand, fontWeight: 600 }}>
            {host}/site/{clip(d.domain, 30)}
          </span>
        </div>
      </div>
    ),
    { width, height, fonts: await loadFonts() },
  );
}
