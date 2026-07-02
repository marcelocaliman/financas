import { createContext, useContext, type ReactNode } from "react";
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

// "row" = cabeçalho horizontal do accordion (padrão). "stack" = vertical (rótulo à esq., valor à
// dir.), usado no tooltip de resumo do menu — reaproveita os MESMOS *Summary sem duplicar KPI.
const KpiVariant = createContext<"row" | "stack">("row");

/** Empilha os HeaderKpi verticalmente — envolve um *Summary p/ virar conteúdo de tooltip. */
export function KpiStack({ children }: { children: ReactNode }) {
  return <KpiVariant.Provider value="stack">{children}</KpiVariant.Provider>;
}

/** Linha compacta de KPIs pro cabeçalho do accordion (ou empilhada, dentro de KpiStack). */
export function HeaderKpis({ children }: { children: ReactNode }) {
  const variant = useContext(KpiVariant);
  if (variant === "stack") return <div className="flex flex-col gap-2">{children}</div>;
  return <div className="flex items-center gap-5 sm:gap-7 lg:gap-9">{children}</div>;
}

/**
 * KPI compacto: rótulo mono pequeno + valor. `secondary` esconde no mobile (só no modo "row").
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
  const variant = useContext(KpiVariant);
  const shown = hidden && !raw ? MONEY_MASK : value;

  // Empilhado (tooltip do menu, desktop): rótulo à esquerda, valor à direita; mostra tudo.
  if (variant === "stack") {
    return (
      <div className="flex items-baseline justify-between gap-5">
        <Eyebrow>{label}</Eyebrow>
        <div className={cn("font-numeric font-semibold tabular text-[13.5px] tracking-[-0.01em] leading-none whitespace-nowrap", TONE[tone])}>
          {shown}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("text-right", secondary && "hidden sm:block")}>
      <Eyebrow>{label}</Eyebrow>
      <div className={cn("font-numeric font-semibold tabular text-[15px] lg:text-[17px] tracking-[-0.01em] mt-1 leading-none whitespace-nowrap", TONE[tone])}>
        {shown}
      </div>
    </div>
  );
}
