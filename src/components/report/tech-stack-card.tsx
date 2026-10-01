import { getTranslations } from "next-intl/server";
import { Layers } from "lucide-react";
import type { Technology } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TechChip } from "./tech-chip";

export async function TechStackCard({ technologies, className }: { technologies: Technology[]; className?: string }) {
  const t = await getTranslations("tech");
  const groups = new Map<string, Technology[]>();
  for (const item of technologies) {
    const cat = item.categories[0] ?? t("other");
    groups.set(cat, [...(groups.get(cat) ?? []), item]);
  }
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="text-muted-foreground size-4" /> {t("detected", { n: technologies.length })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {technologies.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {t("none")}
          </p>
        ) : (
          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            {[...groups].map(([cat, list]) => (
              <div key={cat} className="min-w-0">
                <h3 className="text-muted-foreground mb-2 text-xs font-medium">{cat}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((t) => (
                    <TechChip key={t.name} tech={t} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
