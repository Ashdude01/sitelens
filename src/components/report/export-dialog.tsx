"use client";

import { useMemo, useState } from "react";
import { Check, Code2, Copy, Download, FileImage, FileText, Image as ImageIcon, Link2, Share2 } from "lucide-react";
import type { CardData } from "@/server/export/card-data";
import { badgeSnippet, htmlCardSnippet, imageCardSnippet } from "@/lib/embed-snippets";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

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
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1800);
  };
  return { copied, copy };
}

function Snippet({ id, title, description, code, preview, copied, onCopy }: {
  id: string;
  title: string;
  description: string;
  code: string;
  preview: React.ReactNode;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-muted-foreground text-xs">{description}</p>
        </div>
        <Button size="sm" variant={copied ? "secondary" : "outline"} onClick={onCopy} aria-label={`Copy ${title} code`}>
          {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <div className="bg-muted/40 flex min-h-12 items-center justify-center overflow-hidden rounded-md p-3">{preview}</div>
      <pre className="bg-muted max-h-28 overflow-auto rounded-md p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all" data-snippet={id}>
        {code}
      </pre>
    </div>
  );
}

export function ExportDialog({ data, publicUrl }: { data: CardData; publicUrl: string }) {
  const { copied, copy } = useCopy();
  const [metric, setMetric] = useState<"traffic" | "stack" | "grade">("traffic");
  const [jpgBusy, setJpgBusy] = useState(false);
  const enc = encodeURIComponent(data.domain);
  const cardUrl = `/api/v1/card/${enc}`;
  const file = data.domain.replace(/[^a-z0-9.-]/gi, "_");

  const snippets = useMemo(
    () => ({ badge: badgeSnippet(publicUrl, data, metric), image: imageCardSnippet(publicUrl, data), html: htmlCardSnippet(data) }),
    [publicUrl, data, metric],
  );

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
        <Button size="sm">
          <Share2 /> Export & embed
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export {data.domain}</DialogTitle>
          <DialogDescription>Download the report, or put a live badge on your own site. Every export links back to this report.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="download">
          <TabsList className="w-full">
            <TabsTrigger value="download">
              <Download /> Download
            </TabsTrigger>
            <TabsTrigger value="embed">
              <Code2 /> Embed on your site
            </TabsTrigger>
          </TabsList>

          <TabsContent value="download" className="space-y-4 pt-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- generated PNG preview */}
            <img src={cardUrl} alt={`${data.domain} report card`} width={1200} height={630} className="w-full rounded-lg border" />
            <div className="grid gap-2 sm:grid-cols-3">
              <Button asChild variant="outline">
                <a href={`${cardUrl}?download=1`} download={`${file}-sitelens.png`}>
                  <FileImage /> PNG
                </a>
              </Button>
              <Button variant="outline" onClick={downloadJpg} disabled={jpgBusy}>
                <ImageIcon /> {jpgBusy ? "Converting…" : "JPG"}
              </Button>
              <Button asChild variant="outline">
                <a href={`/api/v1/export/${enc}?format=pdf`} download={`${file}-sitelens-report.pdf`}>
                  <FileText /> PDF report
                </a>
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <input readOnly value={data.reportUrl} aria-label="Report link" className="bg-muted min-w-0 flex-1 rounded-md px-3 py-2 font-mono text-xs" />
              <Button variant="outline" size="sm" onClick={() => copy("link", data.reportUrl)}>
                {copied === "link" ? <Check /> : <Link2 />} {copied === "link" ? "Copied" : "Copy link"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="embed" className="space-y-3 pt-2">
            <Snippet
              id="badge"
              title="Live badge"
              description="Updates automatically after each scan."
              code={snippets.badge}
              copied={copied === "badge"}
              onCopy={() => copy("badge", snippets.badge)}
              preview={
                <div className="flex flex-col items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- live SVG badge */}
                  <img src={`/badge/${enc}.svg${metric === "traffic" ? "" : `?metric=${metric}`}`} alt="Badge preview" height={20} />
                  <div role="radiogroup" aria-label="Badge type" className="flex gap-1">
                    {(["traffic", "stack", "grade"] as const).map((m) => (
                      <button
                        key={m}
                        role="radio"
                        aria-checked={metric === m}
                        onClick={() => setMetric(m)}
                        className={cn("rounded px-2 py-0.5 text-[11px] capitalize", metric === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
                      >
                        {m === "stack" ? "Tech stack" : m === "grade" ? "Security" : "Traffic"}
                      </button>
                    ))}
                  </div>
                </div>
              }
            />
            <Snippet
              id="image"
              title="Live image card"
              description="The card image, always up to date. Works in any site builder."
              code={snippets.image}
              copied={copied === "image"}
              onCopy={() => copy("image", snippets.image)}
              // eslint-disable-next-line @next/next/no-img-element -- live PNG card
              preview={<img src={`${cardUrl}?size=small`} alt="Card preview" width={300} height={158} className="rounded-md border" />}
            />
            <Snippet
              id="html"
              title="HTML card"
              description="Plain HTML you can restyle. Numbers are a snapshot from this scan."
              code={snippets.html}
              copied={copied === "html"}
              onCopy={() => copy("html", snippets.html)}
              preview={<div className="w-full" dangerouslySetInnerHTML={{ __html: snippets.html }} />}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
