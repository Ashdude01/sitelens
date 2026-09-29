import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  A: "text-success",
  B: "text-success",
  C: "text-warning",
  D: "text-destructive",
  F: "text-destructive",
};

/** Circular meter: fill carries the score, the grade letter is always printed (never color alone). */
export function ScoreRing({ score, grade, size = 72, label }: { score: number; grade: string; size?: number; label: string }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className={cn("relative shrink-0", TONE[grade])} style={{ width: size, height: size }} role="img" aria-label={`${label}: ${score} out of 100, grade ${grade}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.15} strokeWidth={6} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * c} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-none">
        <div>
          <p className="text-foreground text-xl font-semibold">{grade}</p>
          <p className="text-muted-foreground mt-0.5 text-[10px]">{score}/100</p>
        </div>
      </div>
    </div>
  );
}
