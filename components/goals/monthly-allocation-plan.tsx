import Link from "next/link";
import { ArrowDown } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Money } from "@/components/ui/money";
import { CURRENCY_SYMBOLS } from "@/lib/financial/currency";
import { GOAL_TYPE_ICONS } from "./goal-icons";
import type { AllocationLine } from "@/services/goals";
import type { Currency } from "@/types/database";

/**
 * "Plano de aportes do mês" — visualiza como a sobra mensal é distribuída
 * entre as metas seguindo prioridade + modo de alocação. Tipo um waterfall:
 *
 *   Sua sobra: R$ 5.000
 *   ├─ 1. Reserva (fixed R$ 1.500)  → R$ 1.500
 *   ├─ 2. Casa (30% da sobra)       → R$ 1.050
 *   ├─ 3. Viagem (waterfall)        → R$ 2.450
 *   └─ Sobra livre: R$ 0
 *
 * Card que substitui o "ETA divide sobra inteira por meta" otimista demais
 * que existia antes — agora o cálculo é coordenado entre todas as metas.
 */
export function MonthlyAllocationPlan({
  monthlySavings,
  lines,
  leftover,
  goalIcons,
}: {
  monthlySavings: number;
  lines: AllocationLine[];
  leftover: number;
  /** Map goalId → goalType pra renderizar ícone */
  goalIcons: Map<string, keyof typeof GOAL_TYPE_ICONS>;
}) {
  const sumAllocated = lines.reduce((s, l) => s + l.allocated, 0);
  const linesWithAlloc = lines.filter((l) => l.allocated > 0);

  return (
    <Panel className="!p-7">
      <PanelHeader
        title="Plano de aportes do mês"
        meta={`distribuição da sua sobra média de ${formatBRL(monthlySavings)}/mês`}
      />

      {monthlySavings <= 0 ? (
        <div className="text-center py-8 text-[13px] text-muted-foreground italic">
          Sem sobra mensal — as metas precisam de aporte manual via{" "}
          <span className="font-mono">+ Aportar</span> no card.
        </div>
      ) : lines.length === 0 ? (
        <div className="text-center py-8 text-[13px] text-muted-foreground italic">
          Nenhuma meta ativa com modo automático ainda. Configure em cada meta
          o modo (R$ fixo, % da sobra ou Cascata).
        </div>
      ) : (
        <>
          {/* Top: sobra total */}
          <div className="rounded-[8px] bg-surface-muted px-5 py-3 mb-4 flex items-baseline justify-between">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
              Sobra média /mês
            </span>
            <span className="font-mono text-[18px] tabular-nums text-foreground">
              {formatBRL(monthlySavings)}
            </span>
          </div>

          {/* Waterfall */}
          <ul className="space-y-2">
            {linesWithAlloc.map((l, idx) => (
              <li
                key={l.goalId}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-1"
              >
                <span className="font-mono text-[10.5px] text-faint-foreground w-5 text-right tabular-nums">
                  {idx + 1}
                </span>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[15px]" aria-hidden>
                    {GOAL_TYPE_ICONS[goalIcons.get(l.goalId) ?? "outro"]}
                  </span>
                  <Link
                    href="/metas"
                    className="text-[13.5px] text-foreground hover:text-navy-700 truncate"
                  >
                    {l.goalName}
                  </Link>
                  <span className="font-mono text-[10px] text-faint-foreground tracking-[0.04em] shrink-0">
                    · {modeBadge(l.mode)}
                  </span>
                </div>
                <Money
                  value={l.allocated}
                  currency={l.goalCurrency}
                  className="font-mono text-[13px] font-medium tabular-nums text-foreground inline-flex !flex-row !items-baseline"
                />
              </li>
            ))}
          </ul>

          {/* Footer: sobra livre */}
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium inline-flex items-center gap-1.5">
                <ArrowDown className="w-3 h-3" strokeWidth={1.8} />
                Sobra livre
              </span>
              <span
                className={
                  "font-mono text-[14px] tabular-nums " +
                  (leftover > 0
                    ? "text-olive-700 dark:text-olive-500"
                    : "text-faint-foreground")
                }
              >
                {formatBRL(leftover)}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
              {leftover > 0
                ? "Sobra livre vai pra reinvestimento, gastos discricionários ou pra você adicionar uma meta em cascata."
                : sumAllocated > monthlySavings * 1.05
                  ? "Você comprometeu mais do que sua sobra média — considere reduzir aportes fixos ou priorizar."
                  : "Toda a sobra está sendo direcionada pras metas."}
            </p>
          </div>
        </>
      )}
    </Panel>
  );
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

function modeBadge(mode: AllocationLine["mode"]): string {
  if (mode === "fixed_amount") return "fixo";
  if (mode === "percentage") return "%";
  if (mode === "waterfall") return "cascata";
  return "manual";
}

// CURRENCY_SYMBOLS used implicitly via Money — re-export to silence lint
export { CURRENCY_SYMBOLS };

// Currency type used in props
export type { Currency };
