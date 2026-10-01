import { getTranslations } from "next-intl/server";
import { CircleCheck, CircleX } from "lucide-react";
import type { Score } from "@/lib/estimates/scores";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreRing } from "@/components/charts/score-ring";
import { Section } from "./section-nav";

export async function HealthSection({ scores }: { scores: Score[] | null }) {
  if (!scores) return null;
  const t = await getTranslations("health");
  return (
    <Section id="health" title={t("title")}>
      <div className="grid gap-4 md:grid-cols-3">
        {scores.map((s) => {
          const failing = s.checks.filter((c) => !c.pass);
          const passing = s.checks.filter((c) => c.pass);
          return (
            <Card key={s.id}>
              <CardHeader className="flex flex-row items-center gap-4">
                <ScoreRing score={s.score} grade={s.grade} label={t(s.id)} />
                <div>
                  <CardTitle>{t(s.id)}</CardTitle>
                  <p className="text-muted-foreground mt-1 text-sm">{t("passed", { ok: passing.length, total: s.checks.length })}</p>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {failing.map((c) => (
                    <li key={c.code} className="flex gap-2">
                      <CircleX className="text-destructive mt-0.5 size-4 shrink-0" />
                      <span>
                        {t(`check.${c.code}`)}
                        <span className="text-muted-foreground block text-xs">{t(`tip.${c.code}`, c.params)}</span>
                      </span>
                    </li>
                  ))}
                  {passing.map((c) => (
                    <li key={c.code} className="text-muted-foreground flex gap-2">
                      <CircleCheck className="text-success mt-0.5 size-4 shrink-0" />
                      {t(`check.${c.code}`)}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </Section>
  );
}
