import { cn } from "@/lib/utils";

/** Label/value list used across report cards. */
export function KV({ rows, className }: { rows: [React.ReactNode, React.ReactNode][]; className?: string }) {
  return (
    <dl className={cn("divide-y text-sm", className)}>
      {rows.map(([k, v], i) => (
        <div key={i} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 py-2 first:pt-0 last:pb-0">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn("text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase", className)}>{children}</h3>;
}

export const Dash = () => <span className="text-muted-foreground">—</span>;
