import type { ReactNode } from "react";
import { Eyebrow } from "./tile";
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
 * as seções pra dar densidade de informação aos indicadores.
 */
export function Kpi({
  label,
  value,
  sub,
  tone = "text",
  bar,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  /** 0–100: desenha uma barra fina de proporção. */
  bar?: number;
}) {
  return (
    <div className="rounded-[14px] bg-card border border-border px-4 py-3.5 flex flex-col justify-between">
      <Eyebrow>{label}</Eyebrow>
      <div
        className={cn(
          "font-numeric font-semibold tabular tracking-[-0.02em] text-[clamp(19px,2.1vw,25px)] mt-1.5 leading-none",
          TONE[tone],
        )}
      >
        {value}
      </div>
      {sub != null ? <div className="text-[11.5px] text-faint mt-1.5 leading-tight">{sub}</div> : null}
      {typeof bar === "number" ? (
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
