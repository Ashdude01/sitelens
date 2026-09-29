import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** KPI tile: label · value (compact) · optional range line · small note. */
export function StatTile({
  icon: Icon,
  label,
  value,
  range,
  note,
  muted = false,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  range?: string | null;
  note?: React.ReactNode;
  muted?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("bg-card flex min-w-0 flex-col gap-1 rounded-xl border p-4", className)}>
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
        <Icon className="size-3.5" />
        <span className="truncate">{label}</span>
      </div>
      <p className={cn("truncate text-2xl font-semibold tracking-tight", muted && "text-muted-foreground text-lg")}>{value}</p>
      {range && <p className="text-muted-foreground truncate text-xs tabular-nums">{range}</p>}
      {note && <div className="text-muted-foreground mt-auto pt-1 text-[11px] leading-snug">{note}</div>}
    </div>
  );
}
