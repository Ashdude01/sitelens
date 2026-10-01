"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import type { CardData } from "@/server/export/card-data";
import { badgeSnippet, htmlCardSnippet, imageCardSnippet } from "@/lib/embed-snippets";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type EmbedKind = "badge" | "image" | "html";
type BadgeMetric = "traffic" | "stack" | "grade";

const EMBEDS: { id: EmbedKind; label: string }[] = [
  { id: "badge", label: "Badge" },
  { id: "image", label: "Image" },
  { id: "html", label: "HTML" },
];

const METRICS: { id: BadgeMetric; label: string }[] = [
  { id: "traffic", label: "Traffic" },
  { id: "stack", label: "Stack" },
  { id: "grade", label: "Security" },
];

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1600);
  };
  return { copied, copy };
}

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (id: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="bg-muted grid gap-0.5 rounded-lg p-0.5"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            "h-7 rounded-md px-1 text-xs font-medium",
            value === option.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ExportDialog({ data, publicUrl }: { data: CardData; publicUrl: string }) {
  const { copied, copy } = useCopy();
  const t = useTranslations("export");
  const [panel, setPanel] = useState<"download" | "embed">("download");
  const [embed, setEmbed] = useState<EmbedKind>("badge");
  const [metric, setMetric] = useState<BadgeMetric>("traffic");
  const [showCode, setShowCode] = useState(false);
  const [jpgBusy, setJpgBusy] = useState(false);
  const enc = encodeURIComponent(data.domain);
  const cardUrl = `/api/v1/card/${enc}`;
  const file = data.domain.replace(/[^a-z0-9.-]/gi, "_");

  const snippets = useMemo(
    () => ({ badge: badgeSnippet(publicUrl, data, metric), image: imageCardSnippet(publicUrl, data), html: htmlCardSnippet(data) }),
    [publicUrl, data, metric],
  );
  const code = snippets[embed];

  const downloadJpg = async () => {
    setJpgBusy(true);
    try {
      const blob = await (await fetch(cardUrl)).blob();
      const bmp = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bmp, 0, 0);
      const jpg = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.92));
      if (!jpg) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(jpg);
      a.download = `${file}-sitelens.jpg`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } finally {
      setJpgBusy(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Share2 /> {t("export")}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(92dvh,34rem)] w-[min(26rem,calc(100%-1.25rem))] flex-col gap-3 overflow-hidden p-4 sm:max-w-md sm:p-5">
        <DialogHeader className="gap-1 pr-6 text-left">
          <DialogTitle className="text-base">{t("export")}</DialogTitle>
          <DialogDescription className="truncate text-xs">{data.domain}</DialogDescription>
        </DialogHeader>

        <Choice label={t("type")} value={panel} options={[{ id: "download", label: t("download") }, { id: "embed", label: t("embed") }]} onChange={setPanel} />

        {panel === "download" ? (
          <div className="min-h-0 space-y-3 overflow-y-auto">
            {/* eslint-disable-next-line @next/next/no-img-element -- generated PNG preview */}
            <img src={cardUrl} alt={t("cardAlt", { domain: data.domain })} width={1200} height={630} className="aspect-[40/21] w-full rounded-md border object-cover" />
            <div className="grid grid-cols-2 gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={`${cardUrl}?download=1`} download={`${file}-sitelens.png`}>
                  PNG
                </a>
              </Button>
              <Button variant="outline" size="sm" onClick={downloadJpg} disabled={jpgBusy}>
                {jpgBusy ? t("saving") : "JPG"}
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={`/api/v1/export/${enc}?format=pdf`} download={`${file}-sitelens-report.pdf`}>
                  PDF
                </a>
              </Button>
              <Button variant="outline" size="sm" onClick={() => copy("link", data.reportUrl)}>
                {copied === "link" ? <Check /> : null}
                {copied === "link" ? t("copied") : t("copyLink")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="min-h-0 space-y-3 overflow-y-auto">
            <Choice label={t("embedType")} value={embed} onChange={setEmbed} options={[{ id: "badge", label: t("badge") }, { id: "image", label: t("image") }, { id: "html", label: t("html") }]} />
            <div className={cn("flex items-center justify-center overflow-hidden", embed === "badge" ? "py-1" : "bg-muted/40 min-h-16 rounded-md p-3")}>
              {embed === "badge" ? (
                // eslint-disable-next-line @next/next/no-img-element -- live SVG badge
                <img src={`/badge/${enc}.svg${metric === "traffic" ? "" : `?metric=${metric}`}`} alt="" height={20} className="max-w-full" />
              ) : embed === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element -- live PNG card
                <img src={`${cardUrl}?size=small`} alt="" width={300} height={158} className="w-full max-w-xs rounded-md border" />
              ) : (
                <div className="w-full overflow-hidden [&_div]:max-w-full" dangerouslySetInnerHTML={{ __html: snippets.html }} />
              )}
            </div>
            {embed === "badge" && <Choice label={t("badgeType")} value={metric} onChange={setMetric} options={[{ id: "traffic", label: t("traffic") }, { id: "stack", label: t("stack") }, { id: "grade", label: t("security") }]} />}
            <div className="flex items-center gap-2">
              <Button className="min-w-0 flex-1" size="sm" onClick={() => copy(embed, code)}>
                {copied === embed ? <Check /> : <Copy />}
                {copied === embed ? t("copied") : t("copyCode")}
              </Button>
              <Button size="sm" variant="ghost" className="shrink-0" onClick={() => setShowCode((v) => !v)}>
                {showCode ? t("hide") : t("code")}
              </Button>
            </div>
            {showCode && (
              <pre className="bg-muted max-h-24 overflow-auto rounded-md p-2 font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap" data-snippet={embed}>
                {code}
              </pre>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
