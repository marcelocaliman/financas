import type { ReactNode } from "react";
import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";

/**
 * Kit visual da V2 — cards brancos bem arredondados (22px), sombras suaves, tipografia
 * limpa. Usado pelo Dashboard e por todas as páginas re-skinadas. Mesmos dados/lógica da V1.
 */

export const v2Card = "rounded-[22px] bg-card border border-border shadow-[var(--shadow-card)]";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn(v2Card, className)}>{children}</div>;
}

/** Cabeçalho de uma seção/card: título + ação/valor à direita. */
export function CardHead({ children, right, className }: { children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 mb-4", className)}>
      <h3 className="text-[14px] font-semibold tracking-[-0.01em]">{children}</h3>
      {right}
    </div>
  );
}

/** Rótulo pequeno (substitui o eyebrow mono da V1 por algo mais clean). */
export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("text-[11.5px] font-medium uppercase tracking-[0.06em] text-faint", className)}>{children}</span>;
}

type Tone = "text" | "accent" | "neg" | "muted";
const TONE: Record<Tone, string> = { text: "text-text", accent: "text-accent", neg: "text-neg", muted: "text-muted" };

/** Card de KPI/estatística — rótulo + número grande + sub. Respeita o modo privacidade. */
export function StatCard({
  label,
  value,
  sub,
  tone = "text",
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(v2Card, "p-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        {icon ? <span className="text-faint shrink-0">{icon}</span> : null}
      </div>
      <div className={cn("font-numeric font-semibold text-[clamp(1.25rem,2.2vw,1.6rem)] tracking-[-0.02em] tabular mt-2 leading-none", TONE[tone])}>
        {value}
      </div>
      {sub ? <div className="text-[11.5px] text-faint mt-1.5">{sub}</div> : null}
    </div>
  );
}

/** Mascara um valor numérico em texto quando o modo privacidade está ativo. */
export function Private({ children }: { children: ReactNode }) {
  const hidden = useUI((s) => s.numbersHidden);
  return <>{hidden ? "••••" : children}</>;
}

/** Cabeçalho de página: título grande + faixa de KPIs (cards). */
export function PageHeader({ title, kpis }: { title: string; kpis?: ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="text-[clamp(1.5rem,2.6vw,2rem)] font-semibold tracking-[-0.025em] mb-4">{title}</h2>
      {kpis ? <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{kpis}</div> : null}
    </div>
  );
}

/** Container de seção dentro de uma página (título opcional + conteúdo em card). */
export function Section({ title, right, children, className }: { title?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={cn("p-6", className)}>
      {title ? <CardHead right={right}>{title}</CardHead> : null}
      {children}
    </Card>
  );
}

/** Grade tipo "masonry" (CSS columns) — preenche telas largas sem buracos. */
export function Masonry({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("columns-1 md:columns-2 xl:columns-3 2xl:columns-4 gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid", className)}>{children}</div>;
}
