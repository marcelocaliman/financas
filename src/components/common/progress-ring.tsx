import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Anel de progresso discreto (SVG) — trilho hairline + arco no acento. Usado na manchete
 * Liberdade. O arco é capado em 0–100 (a barra/anel não passa de 100, mas o número pode).
 */
export function ProgressRing({
  pct,
  size = 120,
  stroke = 9,
  className,
  children,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  className?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  const offset = circ * (1 - clamped / 100);
  return (
    <div className={cn("relative inline-grid place-items-center shrink-0", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="text-border" stroke="currentColor" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className="text-accent transition-[stroke-dashoffset] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        />
      </svg>
      {children ? <div className="absolute inset-0 grid place-items-center">{children}</div> : null}
    </div>
  );
}
