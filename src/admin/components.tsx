import type { ReactNode } from "react";
import { Eyebrow } from "@/components/common/tile";
import { cn } from "@/lib/utils";

/** Card seco no padrão do app (hairline + surface + radius 16). */
export function AdminCard({
  title,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-[16px] border border-border bg-card p-5 sm:p-6", className)}>
      {title || action ? (
        <div className="flex items-center justify-between gap-3 mb-4">
          {title ? <Eyebrow>{title}</Eyebrow> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </div>
  );
}

type Tone = "text" | "accent" | "neg" | "muted";
const TONE: Record<Tone, string> = {
  text: "text-text",
  accent: "text-accent",
  neg: "text-neg",
  muted: "text-muted",
};

/** Indicador: rótulo mono + número grande tabular (NUNCA mascarado — não é financeiro). */
export function Stat({
  label,
  value,
  sub,
  tone = "text",
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="rounded-[14px] bg-card2 border border-border px-4 py-3.5">
      <Eyebrow>{label}</Eyebrow>
      <div className={cn("font-numeric font-semibold tabular tracking-[-0.02em] text-[clamp(20px,2.2vw,26px)] mt-1.5 leading-none", TONE[tone])}>
        {value}
      </div>
      {sub != null ? <div className="text-[11.5px] text-faint mt-1.5 leading-tight">{sub}</div> : null}
    </div>
  );
}

/** Gráfico de barras fino (SVG): proporções discretas, acento, baseline hairline. */
export function BarsChart({
  data,
  height = 120,
  emptyLabel = "sem dados",
}: {
  data: { label: string; value: number; title?: string }[];
  height?: number;
  emptyLabel?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return <div className="grid place-items-center text-[12px] text-faint" style={{ height }}>{emptyLabel}</div>;
  }
  const n = data.length;
  const gap = n > 40 ? 1 : 2;
  const W = 100; // viewBox em %
  const bw = (W - gap * (n - 1)) / n;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} role="img">
      <line x1="0" y1={height - 0.5} x2={W} y2={height - 0.5} stroke="var(--border)" strokeWidth="0.5" />
      {data.map((d, i) => {
        const h = d.value > 0 ? Math.max(1.5, (d.value / max) * (height - 6)) : 0;
        const x = i * (bw + gap);
        return (
          <rect key={i} x={x} y={height - h} width={bw} height={h} rx="0.8" fill="var(--accent)" opacity={d.value > 0 ? 0.9 : 0}>
            <title>{d.title ?? `${d.label}: ${d.value}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

/** Mostra estado de carregamento / erro / vazio, ou o conteúdo. */
export function StateBlock({
  loading,
  error,
  empty,
  children,
}: {
  loading: boolean;
  error: string | null;
  empty?: boolean;
  children: ReactNode;
}) {
  if (loading) return <div className="py-10 text-center text-[13px] text-faint">Carregando…</div>;
  if (error)
    return (
      <div className="py-8 text-center">
        <div className="text-[13px] text-neg">Não foi possível carregar.</div>
        <div className="text-[11.5px] text-faint mt-1 break-all max-w-md mx-auto">{error}</div>
      </div>
    );
  if (empty) return <div className="py-10 text-center text-[13px] text-faint">Nada por aqui ainda.</div>;
  return <>{children}</>;
}

/** Badge discreto (status de usuário, surface de evento…). */
export function Badge({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "accent" | "neg" }) {
  const cls =
    tone === "accent"
      ? "text-accent border-accent/30 bg-accent-soft"
      : tone === "neg"
        ? "text-neg border-neg/30 bg-[var(--neg-soft)]"
        : "text-muted border-border bg-card2";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium", cls)}>
      {children}
    </span>
  );
}
