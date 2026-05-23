"use client";

import { useState, useTransition } from "react";
import {
  Pencil,
  Archive,
  Trash2,
  Plus,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { archiveGoal, deleteGoal } from "@/services/goals.actions";
import type { EnrichedGoal } from "@/services/goals";
import { estimateCompletion } from "@/lib/financial/projection";
import { formatMoney } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";
import { GoalSheet } from "./goal-sheet";
import { ContributeDialog } from "./contribute-dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useMoneyContext } from "@/components/ui/money-provider";
import { convertOrSame, CURRENCY_SYMBOLS } from "@/lib/financial/currency";
import { GOAL_TYPE_ICONS, GOAL_TYPE_LABELS } from "./goal-icons";
import { cn } from "@/lib/utils/cn";

/**
 * Card de meta v2 — visão completa em uma tela:
 *  - Tipo + status semáforo
 *  - Progresso com marcos de 25/50/75/100%
 *  - Fontes vinculadas (com saldo live de cada)
 *  - Plano de aporte: modo de alocação + valor
 *  - ETA realista (usando aporte planejado, não sobra inteira)
 *  - Ações: Aportar, Editar, Arquivar, Excluir
 */
export function GoalCard({
  goal,
  accounts,
  averageMonthlyAddition,
}: {
  goal: EnrichedGoal;
  accounts: { id: string; name: string; institution: string }[];
  /** Sobra média mensal em moeda de exibição */
  averageMonthlyAddition: number;
}) {
  const [editing, setEditing] = useState(false);
  const [contributing, setContributing] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const { displayCurrency, rates } = useMoneyContext();

  const current = goal.derivedCurrent;
  const target = Number(goal.target_amount);
  const pct = target > 0 ? Math.min(1, current / target) : 0;
  const remaining = Math.max(0, target - current);

  // Aporte efetivo planejado para esta meta (em moeda da meta)
  const plannedMonthlyInGoal = computePlannedMonthly(goal, averageMonthlyAddition, displayCurrency, rates);
  const eta = estimateCompletion(current, target, plannedMonthlyInGoal);

  const showsForeignCurrency = goal.currency !== displayCurrency;

  const targetMonthLabel = goal.target_date
    ? new Date(goal.target_date + "T00:00:00Z").toLocaleDateString("pt-BR", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : null;
  const etaMonthLabel = eta.etaDate
    ? new Date(eta.etaDate + "T00:00:00Z").toLocaleDateString("pt-BR", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : null;

  const handleArchive = async () => {
    const ok = await confirm({
      title: `Arquivar meta "${goal.name}"?`,
      description: "Some das listas mas pode ser restaurada depois.",
      confirmLabel: "Arquivar",
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await archiveGoal(goal.id);
      if (r.error) toast.error(r.error);
      else toast.success("Meta arquivada.");
    });
  };

  const handleDelete = async () => {
    const ok = await confirm({
      eyebrow: "Ação irreversível",
      title: `Excluir meta "${goal.name}" DEFINITIVAMENTE?`,
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await deleteGoal(goal.id);
      if (r.error) toast.error(r.error);
      else toast.success("Meta excluída.");
    });
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-[var(--radius-lg)] border border-border bg-surface px-8 py-7 hover:shadow-sm transition-shadow group"
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[20px]" aria-hidden>
                {GOAL_TYPE_ICONS[goal.goal_type]}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
                {GOAL_TYPE_LABELS[goal.goal_type]}
              </span>
              <StatusBadge status={goal.status} />
              {showsForeignCurrency ? (
                <Badge tone="gold">
                  {CURRENCY_SYMBOLS[goal.currency]} {goal.currency}
                </Badge>
              ) : null}
            </div>
            <h3 className="font-display text-[24px] tracking-[-0.02em] font-medium text-foreground">
              {goal.name}
            </h3>
            {goal.description ? (
              <p className="text-[13.5px] text-muted-foreground mt-1.5">{goal.description}</p>
            ) : null}
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              variant="primary"
              onClick={() => setContributing(true)}
              disabled={pending}
            >
              <Plus className="w-3 h-3" strokeWidth={2} />
              Aportar
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setEditing(true)} aria-label="Editar">
              <Pencil className="w-3.5 h-3.5" strokeWidth={1.7} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              disabled={pending}
              onClick={handleArchive}
              aria-label="Arquivar"
              className="text-rust-600"
            >
              <Archive className="w-3.5 h-3.5" strokeWidth={1.7} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              disabled={pending}
              onClick={handleDelete}
              aria-label="Excluir definitivamente"
              className="text-rust-600"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
            </Button>
          </div>
        </div>

        {/* Progresso + milestones */}
        <div className="mt-5">
          <MilestoneProgressBar pct={pct} />
          <div className="flex justify-between mt-2.5 font-mono text-[12.5px] tabular-nums">
            <span className="font-medium text-foreground">
              <MoneyMask>{formatMoney(current, goal.currency)}</MoneyMask>{" "}
              <span className="text-faint-foreground">· {Math.round(pct * 100)}%</span>
            </span>
            <span className="text-muted-foreground">
              <MoneyMask>{formatMoney(target, goal.currency)}</MoneyMask>
            </span>
          </div>
        </div>

        {/* Grid de detalhes: fontes (esquerda) + plano de aporte/ETA (direita) */}
        <div className="grid sm:grid-cols-[1.4fr_1fr] gap-6 mt-6 pt-5 border-t border-border">
          {/* Fontes vinculadas */}
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-2.5">
              {goal.sourcesResolved.length === 0 ? "Sem fontes vinculadas" : "Fontes vinculadas"}
            </div>
            {goal.sourcesResolved.length === 0 ? (
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                Use o botão{" "}
                <span className="inline-flex items-center gap-0.5 font-mono">
                  <Pencil className="w-3 h-3 inline" strokeWidth={1.7} /> Editar
                </span>{" "}
                pra vincular contas ou investimentos que servem como &ldquo;já tenho&rdquo;.
                O valor sobe live conforme essas fontes crescem.
              </p>
            ) : (
              <ul className="space-y-2">
                {goal.sourcesResolved.map((r) => (
                  <li
                    key={r.source.id}
                    className="flex items-baseline justify-between gap-2 text-[12.5px] font-mono"
                  >
                    <span className="text-muted-foreground truncate">{r.label}</span>
                    <span className="text-foreground tabular-nums shrink-0">
                      <MoneyMask>{formatMoney(r.earmarked, goal.currency)}</MoneyMask>
                      {r.source.allocated_pct != null ? (
                        <span className="text-faint-foreground ml-1 text-[10.5px]">
                          ({Math.round(Number(r.source.allocated_pct) * 100)}% de{" "}
                          <MoneyMask>{formatMoney(r.sourceBalance, goal.currency)}</MoneyMask>)
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Plano de aporte + ETA */}
          <div className="space-y-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-1">
                Aporte planejado
              </div>
              <div className="font-mono text-[15px] text-foreground tabular-nums">
                {plannedMonthlyInGoal > 0 ? (
                  <>
                    <MoneyMask>{formatMoney(plannedMonthlyInGoal, goal.currency)}</MoneyMask>
                    <span className="text-faint-foreground text-[11px] ml-1">/ mês</span>
                  </>
                ) : (
                  <span className="text-faint-foreground text-[12.5px] italic">manual</span>
                )}
              </div>
              <div className="font-mono text-[10.5px] text-faint-foreground mt-0.5">
                {modeLabel(goal.allocation_mode)}
              </div>
            </div>

            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-1">
                <Clock className="w-3 h-3 inline mr-1" strokeWidth={1.7} />
                Previsão
              </div>
              <div className="font-mono text-[15px] text-navy-900 dark:text-navy-100">
                {eta.months === 0 || pct >= 1
                  ? "Pronto"
                  : eta.months === null
                    ? "—"
                    : etaMonthLabel ?? `${eta.months} meses`}
              </div>
              <div className="font-mono text-[10.5px] text-muted-foreground mt-0.5">
                {eta.months === null
                  ? "sem aportes recentes"
                  : pct >= 1
                    ? "meta atingida"
                    : `faltam ${formatMoneyCompact(remaining, goal.currency)}`}
              </div>
              {targetMonthLabel ? (
                <div className="font-mono text-[10px] text-faint-foreground mt-1.5">
                  meta original: {targetMonthLabel}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </motion.div>

      <GoalSheet open={editing} onOpenChange={setEditing} goal={goal} accounts={accounts} />
      <ContributeDialog
        open={contributing}
        onOpenChange={setContributing}
        goalId={goal.id}
        goalName={goal.name}
        goalCurrency={goal.currency}
      />
    </>
  );
}

function StatusBadge({ status }: { status: EnrichedGoal["status"] }) {
  if (status === "concluida") {
    return (
      <Badge tone="olive">
        <CheckCircle2 className="w-3 h-3" strokeWidth={1.8} />
        Concluída
      </Badge>
    );
  }
  if (status === "adiantada") {
    return (
      <Badge tone="olive">
        <TrendingUp className="w-3 h-3" strokeWidth={1.8} />
        Adiantada
      </Badge>
    );
  }
  if (status === "atrasada") {
    return (
      <Badge tone="rust">
        <AlertCircle className="w-3 h-3" strokeWidth={1.8} />
        Atrasada
      </Badge>
    );
  }
  if (status === "no_ritmo") {
    return <Badge tone="navy">No ritmo</Badge>;
  }
  return null;
}

function MilestoneProgressBar({ pct }: { pct: number }) {
  return (
    <div className="relative">
      <div className="h-2 bg-surface-muted rounded-full overflow-hidden">
        <motion.div
          className={cn(
            "h-full rounded-full",
            pct >= 1 ? "bg-olive-600" : "bg-navy-800",
          )}
          initial={{ width: "0%" }}
          animate={{ width: `${Math.min(100, pct * 100)}%` }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      {/* Marcos: 25, 50, 75 */}
      {[0.25, 0.5, 0.75].map((m) => (
        <div
          key={m}
          className={cn(
            "absolute top-1/2 -translate-y-1/2 w-[2px] h-[10px] rounded-sm",
            pct >= m ? "bg-white/60" : "bg-bone-300 dark:bg-ink-600",
          )}
          style={{ left: `${m * 100}%` }}
          aria-hidden
        />
      ))}
    </div>
  );
}

function modeLabel(mode: EnrichedGoal["allocation_mode"]): string {
  if (mode === "manual") return "Aporte manual";
  if (mode === "fixed_amount") return "Valor fixo configurado";
  if (mode === "percentage") return "% da sobra mensal";
  if (mode === "waterfall") return "Cascata (sobra do que sobrou)";
  return "—";
}

function computePlannedMonthly(
  goal: EnrichedGoal,
  monthlySavingsInDisplay: number,
  displayCurrency: string,
  rates: Record<string, number>,
): number {
  if (goal.allocation_mode === "manual") return 0;
  // Aproximação local: pra cards individuais, calcula sem coordenar entre metas
  // (o waterfall completo está no MonthlyAllocationPlan no topo da página).
  if (goal.allocation_mode === "fixed_amount" && goal.allocation_value != null) {
    return Number(goal.allocation_value);
  }
  if (goal.allocation_mode === "percentage" && goal.allocation_value != null) {
    const inDisplay = monthlySavingsInDisplay * Number(goal.allocation_value);
    return convertOrSame(inDisplay, displayCurrency as "BRL" | "EUR" | "USD", goal.currency, rates);
  }
  if (goal.allocation_mode === "waterfall") {
    // Estimativa otimista — assume que toda a sobra cai aqui
    return convertOrSame(monthlySavingsInDisplay, displayCurrency as "BRL" | "EUR" | "USD", goal.currency, rates);
  }
  return 0;
}

function formatMoneyCompact(v: number, currency: "BRL" | "EUR" | "USD"): string {
  const symbol = CURRENCY_SYMBOLS[currency];
  if (v >= 1_000_000) return `${symbol} ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 10_000) return `${symbol} ${(v / 1000).toFixed(0)}k`;
  return formatMoney(v, currency);
}
