export interface Segment {
  label: string;
  pct: number;
  color: string;
}

/** Barra de composição "aurora": segmentos com gradiente + glow, legenda pulsante. */
export function CompositionBar({ segments }: { segments: Segment[] }) {
  const visible = segments.filter((s) => s.pct > 0);
  return (
    <div>
      <div className="flex gap-[3px] h-[12px] rounded-full overflow-hidden bg-card2">
        {visible.map((s) => (
          <div
            key={s.label}
            className="h-full first:rounded-l-full last:rounded-r-full transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{
              width: `${s.pct}%`,
              background: `linear-gradient(180deg, ${s.color}, ${s.color}cc)`,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.28), 0 0 14px -3px ${s.color}`,
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3.5 text-[13px]">
        {visible.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span
              className="w-[9px] h-[9px] rounded-full pulse"
              style={{ background: s.color, boxShadow: `0 0 8px -1px ${s.color}` }}
            />
            <span className="text-muted">{s.label}</span>
            <span className="font-semibold tabular text-text">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
