"use client";

import { useState, useTransition } from "react";
import {
  Pencil,
  Archive,
  Trash2,
  Plus,
  Minus,
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
import type { GoalReminder } from "@/services/goal-reminders";
import { estimateCompletion } from "@/lib/financial/projection";
import { computeFinancing } from "@/lib/financial/mortgage";
import { formatMoney } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";
import { GoalSheet } from "./goal-sheet";
import { ContributeDialog } from "./contribute-dialog";
import { ReminderDatePill } from "./reminder-date-pill";
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
  investments = [],
  averageMonthlyAddition,
  reminder,
}: {
  goal: EnrichedGoal;
  accounts: { id: string; name: string; institution: string }[];
  investments?: { id: string; ticker: string; name: string }[];
  /** Sobra média mensal em moeda de exibição */
  averageMonthlyAddition: number;
  /**
   * Lembrete de aporte ativo pra essa meta (vencido / hoje / próximo).
   * Quando presente: mostra pill inline + pré-preenche o ContributeDialog
   * com expectedAmount e dueDate.
   */
  reminder?: GoalReminder;
}) {
  const [editing, setEditing] = useState(false);
  const [contributing, setContributing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const { displayCurrency, rates } = useMoneyContext();

  const current = goal.derivedCurrent;
  const target = Number(goal.target_amount);
  const pct = target > 0 ? Math.min(1, current / target) : 0;
  const remaining = Math.max(0, target - current);

  // Contas vinculadas como fonte (usadas como destino no Aportar e origem no Retirar)
  const linkedAccountOptions = goal.sourcesResolved
    .filter((r) => r.source.source_type === "account" && r.source.source_id)
    .map((r) => ({
      accountId: r.source.source_id as string,
      label: `${r.label} (fonte vinculada)`,
    }));

  // Quando há dados de financiamento, computa breakdown pra exibir no card
  const financing =
    goal.property_price != null &&
    goal.property_down_pct != null &&
    goal.property_closing_pct != null &&
    goal.loan_term_months != null &&
    goal.loan_annual_rate_pct != null &&
    goal.loan_system != null
      ? computeFinancing({
          propertyPrice: Number(goal.property_price),
          downPct: Number(goal.property_down_pct),
          closingPct: Number(goal.property_closing_pct),
          loanTermMonths: goal.loan_term_months,
          loanAnnualRatePct: Number(goal.loan_annual_rate_pct),
          loanSystem: goal.loan_system as "sac" | "price",
        })
      : null;

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
        className="rounded-[var(--radius-lg)] border border-border bg-surface px-4 py-5 sm:px-8 sm:py-7 hover:shadow-sm transition-shadow group"
      >
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-4">
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
              {financing ? <Badge tone="navy">🏦 Financiado</Badge> : null}
              {reminder ? <ReminderDatePill reminder={reminder} /> : null}
            </div>
            <h3 className="font-display text-[20px] sm:text-[24px] tracking-[-0.02em] font-medium text-foreground leading-tight">
              {goal.name}
            </h3>
            {goal.description ? (
              <p className="text-[13px] sm:text-[13.5px] text-muted-foreground mt-1.5">{goal.description}</p>
            ) : null}
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            <Button
              size="sm"
              variant="primary"
              onClick={() => setContributing(true)}
              disabled={pending}
            >
              <Plus className="w-3 h-3" strokeWidth={2} />
              Aportar
            </Button>
            {current > 0 ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setWithdrawing(true)}
                disabled={pending}
                className="border-rust-600/40 text-rust-600 hover:bg-rust-600/10"
              >
                <Minus className="w-3 h-3" strokeWidth={2} />
                Retirar
              </Button>
            ) : null}
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

        {/* Plano de financiamento (quando aplicável) */}
        {financing ? (
          <div className="mt-5 pt-5 border-t border-border">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-3 inline-flex items-center gap-1.5">
              🏦 Plano de financiamento
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2.5 text-[12.5px] font-mono">
              <FinancingStat
                label="Preço imóvel"
                value={formatMoney(Number(goal.property_price ?? 0), goal.currency)}
              />
              <FinancingStat
                label="A poupar (entrada + custos)"
                value={formatMoney(financing.totalToSave, goal.currency)}
                tone="olive"
              />
              <FinancingStat
                label="Valor financiado"
                value={formatMoney(financing.loanAmount, goal.currency)}
              />
              <FinancingStat
                label={goal.loan_system === "sac" ? "1ª parcela" : "Parcela mensal"}
                value={`${formatMoney(financing.firstPayment, goal.currency)}/mês`}
                tone="rust"
              />
              <FinancingStat
                label="Prazo"
                value={`${goal.loan_term_months} meses (${Math.round((goal.loan_term_months ?? 0) / 12)}a)`}
              />
              <FinancingStat
                label="Juros (a.a.)"
                value={`${Number(goal.loan_annual_rate_pct ?? 0).toFixed(2).replace(".", ",")}%`}
              />
              <FinancingStat
                label="Juros totais"
                value={formatMoney(financing.totalInterest, goal.currency)}
                tone="rust"
              />
              <FinancingStat
                label="Custo total"
                value={formatMoney(financing.totalCost, goal.currency)}
              />
            </div>
          </div>
        ) : null}
      </motion.div>

      <GoalSheet
        open={editing}
        onOpenChange={setEditing}
        goal={goal}
        accounts={accounts}
        investments={investments}
      />
      <ContributeDialog
        open={contributing}
        onOpenChange={setContributing}
        goalId={goal.id}
        goalName={goal.name}
        goalCurrency={goal.currency}
        mode="deposit"
        accounts={accounts}
        linkedAccounts={linkedAccountOptions}
        // Quando há lembrete ativo, pré-preenche valor + data sugeridos.
        // Usuário pode aceitar 1-click ou ajustar antes de confirmar.
        defaultAmount={reminder?.expectedAmount ?? undefined}
        defaultDate={reminder?.dueDate}
      />
      <ContributeDialog
        open={withdrawing}
        onOpenChange={setWithdrawing}
        goalId={goal.id}
        goalName={goal.name}
        goalCurrency={goal.currency}
        mode="withdraw"
        accounts={accounts}
        linkedAccounts={linkedAccountOptions}
        maxWithdrawable={current}
      />
    </>
  );
}

function FinancingStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "olive" | "rust";
}) {
  const toneClass =
    tone === "olive"
      ? "text-olive-700 dark:text-olive-500 font-medium"
      : tone === "rust"
        ? "text-rust-600 font-medium"
        : "text-foreground";
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-[0.12em] text-faint-foreground">
        {label}
      </div>
      <div className={cn("mt-0.5 tabular-nums", toneClass)}>{value}</div>
    </div>
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
