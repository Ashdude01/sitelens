import { CircleCheck, CircleX } from "lucide-react";
import type { Score } from "@/lib/estimates/scores";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreRing } from "@/components/charts/score-ring";
import { Section } from "./section-nav";

export function HealthSection({ scores }: { scores: Score[] | null }) {
  if (!scores) return null;
  return (
    <Section id="health" title="Health checks" description="Scored only from what we observed on the homepage, DNS and SSL. Fix the red items first.">
      <div className="grid gap-4 md:grid-cols-3">
        {scores.map((s) => {
          const failing = s.checks.filter((c) => !c.pass);
          const passing = s.checks.filter((c) => c.pass);
          return (
            <Card key={s.id}>
              <CardHeader className="flex flex-row items-center gap-4">
                <ScoreRing score={s.score} grade={s.grade} label={s.label} />
                <div>
                  <CardTitle>{s.label}</CardTitle>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {passing.length} of {s.checks.length} checks passed
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {failing.map((c) => (
                    <li key={c.label} className="flex gap-2">
                      <CircleX className="text-destructive mt-0.5 size-4 shrink-0" />
                      <span>
                        {c.label}
                        <span className="text-muted-foreground block text-xs">{c.tip}</span>
                      </span>
                    </li>
                  ))}
                  {passing.map((c) => (
                    <li key={c.label} className="text-muted-foreground flex gap-2">
                      <CircleCheck className="text-success mt-0.5 size-4 shrink-0" />
                      {c.label}
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
