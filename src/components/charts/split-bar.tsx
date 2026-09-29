/** 100% stacked bar for a small categorical split (≤3 parts): 2px surface gaps, legend with values always visible. */
const SLOTS = ["bg-chart-1", "bg-chart-2", "bg-chart-3"];

export function SplitBar({ parts }: { parts: { label: string; value: number }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const visible = parts.slice(0, 3);
  return (
    <div>
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-[4px]" role="img" aria-label={visible.map((p) => `${p.label} ${Math.round((p.value / total) * 100)}%`).join(", ")}>
        {visible.map((p, i) => (
          <div key={p.label} className={SLOTS[i]} style={{ width: `${(p.value / total) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {visible.map((p, i) => (
          <li key={p.label} className="flex items-center gap-1.5">
            <span className={`size-2.5 rounded-full ${SLOTS[i]}`} aria-hidden />
            <span className="capitalize">{p.label}</span>
            <span className="text-muted-foreground tabular-nums">{Math.round((p.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
