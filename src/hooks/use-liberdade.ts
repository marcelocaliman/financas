import { useMemo } from "react";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useProjection } from "@/store/projection";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { useBudget } from "@/hooks/use-budget";
import { useSettings } from "@/hooks/use-settings";
import { convert, type Currency } from "@/money/currency";
import { CLASS, defaultEligibleClass } from "@/domain/taxonomy";
import { fireNumber, realReturn, safeMonthlyIncome } from "@/finance/fire";
import {
  freedomPct as calcFreedomPct,
  yearsOfFreedom as calcYearsOfFreedom,
  monthsToIndependence,
  computeStreak,
  addMonthsLabel,
  suggestWealthMilestones,
  type MonthBalance,
  type Streak,
} from "@/finance/liberdade";

/** Defaults (só ponto de partida — o usuário sobrescreve tudo no Config). */
export const LIBERDADE_DEFAULTS = { costMonths: 6, reserveMonths: 6, streakMinBalance: 0 };

export type MilestoneKind = "wealth" | "reserve" | "freedom";
export interface Milestone {
  kind: MilestoneKind;
  /** Limiar: valor (moeda de exibição) p/ wealth/reserve; porcentagem p/ freedom. */
  value: number;
  achieved: boolean;
}

export interface LiberdadeView {
  /** Tem base suficiente p/ a métrica fazer sentido (custo de vida > 0). */
  ready: boolean;
  disp: Currency;
  eligibleWealth: number;
  netWorth: number;
  monthlyCost: number;
  annualCost: number;
  costFromOverride: boolean;
  withdrawalRate: number;
  independenceNumber: number;
  /** % rumo à independência (NÃO capado — pode passar de 100). */
  freedomPct: number;
  yearsOfFreedom: number | null;
  safeMonthly: number;
  coverage: number;
  remaining: number;
  reached: boolean;
  /** `null` = inalcançável no ritmo atual; `months: 0` = já alcançou. */
  arrival: { months: number; label: string } | null;
  streak: Streak;
  reserve: { current: number; target: number; monthsCovered: number; complete: boolean };
  milestones: Milestone[];
}

/**
 * Monta a métrica Liberdade reusando Patrimônio (elegível), Orçamento (custo/saldo), Projeção
 * (taxa de retirada, aporte, retorno, inflação) e a config do usuário. Tudo na moeda de exibição.
 */
export function useLiberdade(): LiberdadeView | null {
  const disp = useUI((s) => s.displayCurrency);
  const base = useUI((s) => s.baseCurrency);
  const rates = useRates((s) => s.rates);
  const pat = usePatrimonio();
  const budget = useBudget();
  const settings = useSettings();
  const proj = useProjection();

  return useMemo(() => {
    if (!pat || !budget) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const cfg = settings.liberdade ?? {};
    const eligibleClasses = cfg.eligibleClasses ?? {};
    // Override explícito do usuário; na ausência, cai no default honesto (exclui Imóveis e Bens).
    const isEligible = (classId: string) => eligibleClasses[classId] ?? defaultEligibleClass(classId);

    // Patrimônio: total e ELEGÍVEL (classes ligadas) − todos os passivos.
    const assetsTotal = pat.assets.reduce((s, a) => s + conv(a.amount, a.currency), 0);
    const assetsEligible = pat.assets.reduce((s, a) => (isEligible(a.classId) ? s + conv(a.amount, a.currency) : s), 0);
    const liabilities = pat.liabilities.reduce((s, l) => s + conv(l.amount, l.currency), 0);
    const netWorth = assetsTotal - liabilities;
    const eligibleWealth = assetsEligible - liabilities;
    const cash = pat.assets.reduce((s, a) => (a.classId === CLASS.caixa ? s + conv(a.amount, a.currency) : s), 0);

    // Custo de vida: média móvel dos últimos N meses COM lançamento (ou valor-alvo informado).
    const costMonths = Math.max(1, Math.round(cfg.costMonths ?? LIBERDADE_DEFAULTS.costMonths));
    const expByMonth = new Map<string, number>();
    for (const e of budget.expenses) expByMonth.set(e.month, (expByMonth.get(e.month) ?? 0) + conv(e.amount, e.currency));
    const recentMonths = [...expByMonth.keys()].sort((a, b) => b.localeCompare(a)).slice(0, costMonths);
    const movingMonthlyCost = recentMonths.length
      ? recentMonths.reduce((s, m) => s + (expByMonth.get(m) ?? 0), 0) / recentMonths.length
      : 0;
    const costFromOverride = proj.annualExpensesOverride != null;
    const annualCost = costFromOverride ? proj.annualExpensesOverride! : movingMonthlyCost * 12;
    const monthlyCost = annualCost / 12;

    // Núcleo FIRE (reuso).
    const swr = proj.withdrawalRate;
    const independenceNumber = fireNumber(annualCost, swr);
    const ready = annualCost > 0 && Number.isFinite(independenceNumber) && independenceNumber > 0;
    const freedomPct = calcFreedomPct(eligibleWealth, independenceNumber);
    const yearsOfFreedom = calcYearsOfFreedom(eligibleWealth, annualCost);
    const safeMonthly = safeMonthlyIncome(eligibleWealth, swr);
    const coverage = monthlyCost > 0 ? (safeMonthly / monthlyCost) * 100 : 0;
    const remaining = ready ? Math.max(0, independenceNumber - eligibleWealth) : 0;
    const reached = ready && eligibleWealth >= independenceNumber;

    // Data de chegada (ritmo atual): retorno REAL do cenário-base + aporte base.
    const realRet = realReturn(proj.scenarios.base.annualReturn, proj.annualInflation);
    const months = ready
      ? monthsToIndependence({ eligibleWealth, monthlyContribution: proj.scenarios.base.monthly, realAnnualReturn: realRet, independenceNumber })
      : null;
    const arrival = months == null ? null : { months, label: addMonthsLabel(new Date(), months) };

    // Streak de constância: saldo (receitas − gastos) por mês.
    const incByMonth = new Map<string, number>();
    for (const i of budget.incomes) incByMonth.set(i.month, (incByMonth.get(i.month) ?? 0) + conv(i.amount, i.currency));
    const allMonths = new Set<string>([...expByMonth.keys(), ...incByMonth.keys()]);
    const balances: MonthBalance[] = [...allMonths].map((m) => ({ month: m, balance: (incByMonth.get(m) ?? 0) - (expByMonth.get(m) ?? 0) }));
    // Limiar é guardado na moeda PRINCIPAL → converte p/ a moeda de exibição (igual aos marcos).
    const streakMin = conv(cfg.streakMinBalance ?? LIBERDADE_DEFAULTS.streakMinBalance, base);
    const streak = computeStreak(balances, streakMin);

    // Reserva de emergência: caixa ÷ custo mensal ≥ X meses.
    const reserveMonths = Math.max(1, Math.round(cfg.reserveMonths ?? LIBERDADE_DEFAULTS.reserveMonths));
    const reserveTarget = monthlyCost * reserveMonths;
    const reserve = {
      current: cash,
      target: reserveTarget,
      monthsCovered: monthlyCost > 0 ? cash / monthlyCost : 0,
      complete: reserveTarget > 0 && cash >= reserveTarget,
    };

    // Marcos: patrimônio (custom na moeda principal → exibição, ou sugerido) + reserva + liberdade %.
    const customMilestones = (cfg.milestones ?? []).filter((v) => v > 0);
    const wealthValues = customMilestones.length
      ? customMilestones.map((v) => conv(v, base)).sort((a, b) => a - b)
      : suggestWealthMilestones(eligibleWealth);
    const milestones: Milestone[] = [
      ...wealthValues.map((value): Milestone => ({ kind: "wealth", value, achieved: eligibleWealth >= value })),
      ...(reserveTarget > 0 ? [{ kind: "reserve" as const, value: reserveTarget, achieved: reserve.complete }] : []),
      ...[25, 50, 75, 100].map((value): Milestone => ({ kind: "freedom", value, achieved: freedomPct >= value })),
    ];

    return {
      ready, disp, eligibleWealth, netWorth, monthlyCost, annualCost, costFromOverride,
      withdrawalRate: swr, independenceNumber, freedomPct, yearsOfFreedom, safeMonthly, coverage,
      remaining, reached, arrival, streak, reserve, milestones,
    };
  }, [pat, budget, settings, proj, disp, base, rates]);
}
