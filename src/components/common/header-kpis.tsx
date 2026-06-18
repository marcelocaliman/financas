import type { ReactNode } from "react";
import { Eyebrow } from "./tile";
import { MONEY_MASK } from "./money";
import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";

type Tone = "text" | "neg" | "pos" | "accent";

const TONE: Record<Tone, string> = {
  text: "text-text",
  neg: "text-neg",
  pos: "text-pos",
  accent: "text-accent",
};

/** Linha compacta de KPIs pro cabeçalho do accordion (ao lado do título). */
export function HeaderKpis({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-5 sm:gap-7 lg:gap-9">{children}</div>;
}

/**
 * KPI compacto: rótulo mono pequeno + valor. `secondary` esconde no mobile.
 * No modo privacidade oculta o valor (••••) — dinheiro, % E contagens do usuário (nada de
 * número vaza no cabeçalho da seção). `raw` só para METADADO do painel admin.
 */
export function HeaderKpi({
  label,
  value,
  tone = "text",
  secondary,
  raw,
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
  secondary?: boolean;
  /** Só para o painel admin (metadado, não dado do usuário): mantém visível em modo privado. */
  raw?: boolean;
}) {
  const hidden = useUI((s) => s.numbersHidden);
  return (
    <div className={cn("text-right", secondary && "hidden sm:block")}>
      <Eyebrow>{label}</Eyebrow>
      <div className={cn("font-numeric font-semibold tabular text-[15px] lg:text-[17px] tracking-[-0.01em] mt-1 leading-none whitespace-nowrap", TONE[tone])}>
        {hidden && !raw ? MONEY_MASK : value}
      </div>
    </div>
  );
}
