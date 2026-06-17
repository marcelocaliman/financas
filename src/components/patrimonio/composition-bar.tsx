import { Hidden } from "@/components/common/hidden";

export interface Segment {
  label: string;
  pct: number;
  color: string;
}

/** Barra de composição flat (referência): 8px, segmentos sólidos sem glow + legenda em quadradinhos. */
export function CompositionBar({ segments }: { segments: Segment[] }) {
  const visible = segments.filter((s) => s.pct > 0);
  return (
    <div>
      <div className="flex h-[8px] rounded-full overflow-hidden bg-card2">
        {visible.map((s) => (
          <div
            key={s.label}
            className="h-full transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ width: `${s.pct}%`, background: s.color }}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 mt-3.5 text-[13px]">
        {visible.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="w-[8px] h-[8px] rounded-[2px]" style={{ background: s.color }} />
            <span className="text-muted">{s.label}</span>
            <span className="font-semibold tabular text-text"><Hidden>{s.pct + "%"}</Hidden></span>
          </div>
        ))}
      </div>
    </div>
  );
}
