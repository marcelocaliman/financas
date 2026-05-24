"use client";

export function FireCoverageRing({
  coverageRatio,
  classification,
}: {
  coverageRatio: number;
  classification:
    | "achieved"
    | "fat"
    | "regular"
    | "lean"
    | "coast"
    | "barista"
    | "building";
}) {
  const pct = Math.min(100, Math.round(coverageRatio * 100));
  const display = Math.min(100, pct);
  const r = 60;
  const c = 2 * Math.PI * r;
  const achieved =
    classification === "achieved" ||
    classification === "fat" ||
    classification === "regular";

  return (
    <div className="relative w-[150px] h-[150px] shrink-0">
      <svg width="150" height="150" viewBox="0 0 150 150" className="-rotate-90">
        <circle
          cx="75"
          cy="75"
          r={r}
          fill="none"
          stroke="var(--color-navy-100)"
          strokeWidth="8"
        />
        <circle
          cx="75"
          cy="75"
          r={r}
          fill="none"
          stroke={achieved ? "var(--color-olive-600)" : "var(--color-navy-800)"}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - display / 100)}
          className="transition-[stroke-dashoffset] duration-[1500ms] ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center font-mono leading-none">
        <span className="text-[32px] font-medium text-foreground">{Math.round(coverageRatio * 100)}%</span>
        <span className="text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground mt-1.5">
          das despesas
        </span>
      </div>
    </div>
  );
}
