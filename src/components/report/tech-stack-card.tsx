import { Layers } from "lucide-react";
import type { Technology } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TechChip } from "./tech-chip";

export function TechStackCard({ technologies, className }: { technologies: Technology[]; className?: string }) {
  const groups = new Map<string, Technology[]>();
  for (const t of technologies) {
    const cat = t.categories[0] ?? "Other";
    groups.set(cat, [...(groups.get(cat) ?? []), t]);
  }
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="text-muted-foreground size-4" /> {technologies.length} technologies detected
        </CardTitle>
        <CardDescription>Click a technology to learn more, or the (i) to see why we detected it. Faded items are lower-confidence matches.</CardDescription>
      </CardHeader>
      <CardContent>
        {technologies.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No technologies detected. The site may block bots or render everything with JavaScript.
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
