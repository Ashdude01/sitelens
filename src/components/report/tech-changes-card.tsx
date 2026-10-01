import { getTranslations } from "next-intl/server";
import { History } from "lucide-react";
import type { TechChange } from "@/lib/types";
import { isoDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Only rendered when history says something new: a tech removed, or added after the first scan. */
export async function TechChangesCard({ history, className }: { history: TechChange[]; className?: string }) {
  if (!history.length) return null;
  const t = await getTranslations("tech");
  const firstScan = Math.min(...history.map((h) => h.firstSeen));
  const latest = Math.max(...history.map((h) => h.lastSeen));
  const added = history.filter((h) => h.firstSeen > firstScan + 3_600_000 && h.lastSeen === latest);
  const removed = history.filter((h) => h.lastSeen < latest);
  if (!added.length && !removed.length) return null;
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="text-muted-foreground size-4" /> {t("changes")}
        </CardTitle>
        <CardDescription>{t("since", { date: isoDate(firstScan) })}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y text-sm">
          {added.map((h) => (
            <li key={`a-${h.tech}`} className="flex items-center justify-between gap-3 py-2">
              <span className="font-medium">{h.tech}</span>
              <span className="text-muted-foreground flex items-center gap-2">
                <Badge variant="success">{t("added")}</Badge> {isoDate(h.firstSeen)}
              </span>
            </li>
          ))}
          {removed.map((h) => (
            <li key={`r-${h.tech}`} className="flex items-center justify-between gap-3 py-2">
              <span className="font-medium">{h.tech}</span>
              <span className="text-muted-foreground flex items-center gap-2">
                <Badge variant="destructive">{t("removed")}</Badge> {t("lastSeen", { date: isoDate(h.lastSeen) })}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
