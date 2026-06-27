import type { ReactNode } from "react";
import { Eyebrow } from "./tile";
import { MONEY_MASK } from "./money";
import { ProgressRing } from "./progress-ring";
import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";

type Tone = "text" | "neg" | "pos" | "accent";

const TONE: Record<Tone, string> = {
  text: "text-text",
  neg: "text-neg",
  pos: "text-pos",
  accent: "text-accent",
};

/**
 * Card de KPI: rótulo mono + valor grande tabular + linha de contexto opcional
 * (contagem, %, variação…) + barra fina opcional (share/progresso). Usado em todas
 * as seções pra dar densidade de informação aos indicadores. No modo privacidade
 * oculta o valor (••••) — dinheiro, % E contagens do usuário (nada vaza). `raw` só
 * para METADADO do painel admin (não é dado financeiro do usuário), nunca nas seções.
 */
export function Kpi({
  label,
  value,
  sub,
  tone = "text",
  bar,
  ring,
  raw,
  title,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  /** 0–100: desenha uma barra fina de proporção (rodapé do card). */
  bar?: number;
  /** 0–100: anel circular INLINE ao lado do número (mantém o número alinhado com os demais KPIs). */
  ring?: number;
  /** Só para o painel admin (metadado, não dado do usuário): mantém visível em modo privado. */
  raw?: boolean;
  /** Dica em hover (desktop): explicação extra sem poluir o card. SEM números (respeita privacidade). */
  title?: string;
}) {
  const hidden = useUI((s) => s.numbersHidden);
  const valueCls = cn(
    "font-numeric font-semibold tabular tracking-[-0.02em] text-[clamp(19px,2.1vw,25px)] leading-none",
    TONE[tone],
  );
  const rendered = hidden && !raw ? MONEY_MASK : value;
  return (
    <div title={title} className="rounded-[14px] bg-card border border-border px-4 py-3.5 flex flex-col justify-between">
      <Eyebrow>{label}</Eyebrow>
      {typeof ring === "number" ? (
        <div className="flex items-center gap-2.5 mt-1.5">
          <ProgressRing pct={ring} size={28} stroke={3.5} />
          <span className={valueCls}>{rendered}</span>
        </div>
      ) : (
        <div className={cn(valueCls, "mt-1.5")}>{rendered}</div>
      )}
      {sub != null ? <div className="text-[11.5px] text-faint mt-1.5 leading-tight">{sub}</div> : null}
      {typeof bar === "number" && typeof ring !== "number" ? (
        <div className="mt-2.5 h-[4px] rounded-full bg-card2 overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ width: `${Math.min(100, Math.max(0, bar))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
