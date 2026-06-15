export interface Segment {
  label: string;
  pct: number;
  color: string;
}

/** Barra empilhada de composição + legenda com %. */
export function CompositionBar({ segments }: { segments: Segment[] }) {
  const visible = segments.filter((s) => s.pct > 0);
  return (
    <div>
      <div className="flex rounded-full overflow-hidden h-[10px] bg-border">
        {visible.map((s) => (
          <div key={s.label} style={{ width: `${s.pct}%`, background: s.color }} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3 text-[13px]">
        {visible.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="w-[9px] h-[9px] rounded-[3px]" style={{ background: s.color }} />
            <span className="text-muted">{s.label}</span>
            <span className="font-semibold tabular-nums">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
