/**
 * AllocationDonut — gráfico de rosca SVG inline pra mostrar alocação.
 * Recebe segmentos com valor + cor; calcula percentuais internamente.
 *
 * Renderiza com legendas à direita (label + valor + %). Mobile-friendly
 * (legendas viram lista vertical).
 */
export type DonutSegment = {
  key: string;
  label: string;
  value: number;
  color: string;
};

export function AllocationDonut({
  segments,
  size = 180,
  thickness = 18,
  centerLabel,
  centerValue,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const visible = segments.filter((s) => s.value > 0);
  const total = visible.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;

  const arcs = visible.reduce<
    Array<{ seg: DonutSegment; pct: number; dash: number; offset: number }>
  >((acc, seg) => {
    const pct = total > 0 ? seg.value / total : 0;
    const prev = acc[acc.length - 1];
    // offset acumulado em pixels = soma dos dashes anteriores
    const offset = prev ? prev.offset + prev.dash : 0;
    acc.push({
      seg,
      pct,
      dash: c * pct,
      offset,
    });
    return acc;
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-7">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--color-bone-100)"
            strokeWidth={thickness}
            className="dark:stroke-ink-800"
          />
          {arcs.map(({ seg, dash, offset }) => (
            <circle
              key={seg.key}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={thickness}
              strokeDasharray={`${dash} ${c}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              className="transition-all duration-700 ease-out"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {centerLabel ? (
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
              {centerLabel}
            </div>
          ) : null}
          {centerValue ? (
            <div className="font-mono text-[15px] text-foreground tabular-nums mt-0.5 tracking-[-0.01em]">
              {centerValue}
            </div>
          ) : null}
        </div>
      </div>
      <ul className="flex-1 min-w-[180px] space-y-2.5">
        {arcs.map(({ seg, pct }) => (
          <li key={seg.key} className="flex items-baseline gap-3">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full shrink-0 mt-0.5"
              style={{ background: seg.color }}
            />
            <span className="flex-1 text-[13px] text-foreground">{seg.label}</span>
            <span className="font-mono text-[11.5px] text-muted-foreground tabular-nums">
              {(pct * 100).toFixed(pct >= 0.1 ? 0 : 1).replace(".", ",")}%
            </span>
          </li>
        ))}
        {arcs.length === 0 ? (
          <li className="text-[12.5px] text-faint-foreground italic">Sem dados.</li>
        ) : null}
      </ul>
    </div>
  );
}
