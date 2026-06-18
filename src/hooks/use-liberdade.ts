import { useMemo } from "react";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useProjection } from "@/store/projection";
import { useBudget } from "@/hooks/use-budget";
import { useSettings } from "@/hooks/use-settings";
import { useFireTarget, FIRE_DEFAULTS } from "@/hooks/use-fire-target";
import { convert, type Currency } from "@/money/currency";
import { realReturn, safeMonthlyIncome } from "@/finance/fire";
import {
  freedomPct as calcFreedomPct,
  yearsOfFreedom as calcYearsOfFreedom,
  monthsToIndependence,
  computeStreak,
  addMonthsLabel,
  type MonthBalance,
  type Streak,
} from "@/finance/liberdade";

/** Defaults (só ponto de partida — o usuário sobrescreve tudo no Config). A janela de custo
 *  (costMonths) vem da fonte única do número FIRE, p/ Liberdade e Projeção baterem. */
export const LIBERDADE_DEFAULTS = { costMonths: FIRE_DEFAULTS.costMonths, reserveMonths: 6, streakMinBalance: 0 };

export type MilestoneKind = "wealth" | "reserve";
export interface Milestone {
  kind: MilestoneKind;
  /** Valor-limiar na moeda de exibição. */
  value: number;
  achieved: boolean;
  /** Para marcos de patrimônio: % do Número da Independência que o valor representa. */
  pct?: number;
}

export interface LiberdadeView {
  /** Tem base suficiente p/ a métrica fazer sentido (custo de vida > 0). */
  ready: boolean;
  disp: Currency;
  eligibleWealth: number;
  netWorth: number;
  monthlyCost: number;
  annualCost: number;
  costFromTarget: boolean;
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
  /** Renda passiva externa anual (aluguel) descontada do custo. */
  passiveAnnual: number;
  /** Custo anual LÍQUIDO (custo − renda passiva) que a carteira precisa cobrir. */
  netAnnualCost: number;
  /** A renda passiva já cobre todo o custo (independência via renda, sem precisar de carteira). */
  coveredByPassive: boolean;
}

/**
 * Monta a métrica Liberdade reusando Patrimônio (elegível), o número FIRE da fonte única
 * (useFireTarget — mesmo da Projeção/relatório), a Projeção (aporte/retorno/inflação p/ a data
 * de chegada) e a config do usuário (streak, marcos, reserva). Tudo na moeda de exibição.
 */
export function useLiberdade(): LiberdadeView | null {
  const disp = useUI((s) => s.displayCurrency);
  const base = useUI((s) => s.baseCurrency);
  const rates = useRates((s) => s.rates);
  const budget = useBudget();
  const settings = useSettings();
  const proj = useProjection();
  const fire = useFireTarget();

  return useMemo(() => {
    if (!budget || !fire) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const cfg = settings.liberdade ?? {};

    // Patrimônio (total/elegível/caixa) + custo + número da independência — FONTE ÚNICA,
    // a MESMA da Projeção e do relatório (não recalcular aqui, senão volta a divergir).
    const { eligibleWealth, netWorth, cash, annualCost, monthlyCost, budgetMonthlyCost, costFromTarget,
      passiveAnnual, netAnnualCost, withdrawalRate: swr, independenceNumber, ready, coveredByPassive } = fire;

    const finiteTarget = Number.isFinite(independenceNumber) && independenceNumber > 0;
    const freedomPct = coveredByPassive ? 100 : calcFreedomPct(eligibleWealth, independenceNumber);
    const reached = coveredByPassive || (finiteTarget && eligibleWealth >= independenceNumber);
    const remaining = reached || !finiteTarget ? 0 : Math.max(0, independenceNumber - eligibleWealth);
    const yearsOfFreedom = calcYearsOfFreedom(eligibleWealth, netAnnualCost); // null se custo líquido 0 (∞)
    const safeMonthly = safeMonthlyIncome(eligibleWealth, swr);
    const coverage = monthlyCost > 0 ? (safeMonthly / monthlyCost) * 100 : 0;

    // Data de chegada (ritmo atual): retorno REAL do cenário-base + aporte base.
    const realRet = realReturn(proj.scenarios.base.annualReturn, proj.annualInflation);
    const months = reached
      ? 0
      : independenceNumber > 0
        ? monthsToIndependence({ eligibleWealth, monthlyContribution: proj.scenarios.base.monthly, realAnnualReturn: realRet, independenceNumber })
        : null;
    const arrival = months == null ? null : { months, label: addMonthsLabel(new Date(), months) };

    // Streak de constância: saldo (receitas − gastos) por mês (TODOS os meses, não a janela).
    const expByMonth = new Map<string, number>();
    for (const e of budget.expenses) expByMonth.set(e.month, (expByMonth.get(e.month) ?? 0) + conv(e.amount, e.currency));
    const incByMonth = new Map<string, number>();
    for (const i of budget.incomes) incByMonth.set(i.month, (incByMonth.get(i.month) ?? 0) + conv(i.amount, i.currency));
    const allMonths = new Set<string>([...expByMonth.keys(), ...incByMonth.keys()]);
    const balances: MonthBalance[] = [...allMonths].map((m) => ({ month: m, balance: (incByMonth.get(m) ?? 0) - (expByMonth.get(m) ?? 0) }));
    // Limiar é guardado na moeda PRINCIPAL → converte p/ a moeda de exibição (igual aos marcos).
    const streakMin = conv(cfg.streakMinBalance ?? LIBERDADE_DEFAULTS.streakMinBalance, base);
    const streak = computeStreak(balances, streakMin);

    // Reserva de emergência: caixa ÷ custo mensal ≥ X meses.
    const reserveMonths = Math.max(1, Math.round(cfg.reserveMonths ?? LIBERDADE_DEFAULTS.reserveMonths));
    // Reserva de emergência usa o custo ATUAL (do orçamento), não o alvo futuro — é p/ cobrir
    // imprevistos da vida de HOJE.
    const reserveTarget = budgetMonthlyCost * reserveMonths;
    const reserve = {
      current: cash,
      target: reserveTarget,
      monthsCovered: budgetMonthlyCost > 0 ? cash / budgetMonthlyCost : 0,
      complete: reserveTarget > 0 && cash >= reserveTarget,
    };

    // Marcos: lista do usuário (moeda principal → exibição) OU frações do alvo em dinheiro
    // (25/50/75/100% do Número da Independência) + reserva. Atingir 50% ⇔ estar 50% livre.
    const customMilestones = (cfg.milestones ?? []).filter((v) => v > 0);
    const wealthValues = customMilestones.length
      ? customMilestones.map((v) => conv(v, base)).sort((a, b) => a - b)
      : finiteTarget
        ? [0.25, 0.5, 0.75, 1].map((f) => independenceNumber * f)
        : [];
    const milestones: Milestone[] = [
      ...wealthValues.map((value): Milestone => ({
        kind: "wealth",
        value,
        achieved: eligibleWealth >= value,
        pct: finiteTarget ? Math.round((value / independenceNumber) * 100) : undefined,
      })),
      ...(reserveTarget > 0 ? [{ kind: "reserve" as const, value: reserveTarget, achieved: reserve.complete }] : []),
    ];

    return {
      ready, disp, eligibleWealth, netWorth, monthlyCost, annualCost, costFromTarget,
      withdrawalRate: swr, independenceNumber, freedomPct, yearsOfFreedom, safeMonthly, coverage,
      remaining, reached, arrival, streak, reserve, milestones,
      passiveAnnual, netAnnualCost, coveredByPassive,
    };
  }, [budget, fire, settings, proj, disp, base, rates]);
}
