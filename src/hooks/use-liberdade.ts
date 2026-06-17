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
  type MonthBalance,
  type Streak,
} from "@/finance/liberdade";

/** Defaults (só ponto de partida — o usuário sobrescreve tudo no Config). */
export const LIBERDADE_DEFAULTS = { costMonths: 6, reserveMonths: 6, streakMinBalance: 0 };

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
  /** Renda passiva externa anual (aluguel) descontada do custo. */
  passiveAnnual: number;
  /** Custo anual LÍQUIDO (custo − renda passiva) que a carteira precisa cobrir. */
  netAnnualCost: number;
  /** A renda passiva já cobre todo o custo (independência via renda, sem precisar de carteira). */
  coveredByPassive: boolean;
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

    // Renda passiva EXTERNA abate o custo: a carteira só precisa cobrir o LÍQUIDO. As categorias
    // que contam são do usuário (default: aluguel). Dividendos/juros NÃO entram (vêm da carteira
    // contada; a regra dos 4% já os assume). E se o usuário INCLUI Imóveis na elegibilidade, o
    // aluguel NÃO é descontado — senão o imóvel contaria duas vezes (valor + renda).
    const passiveCats = new Set(cfg.passiveCategories ?? ["aluguel"]);
    const rentByMonth = new Map<string, number>();
    for (const i of budget.incomes) {
      if (passiveCats.has(i.categoryId)) rentByMonth.set(i.month, (rentByMonth.get(i.month) ?? 0) + conv(i.amount, i.currency));
    }
    const rentMonths = [...rentByMonth.keys()].sort((a, b) => b.localeCompare(a)).slice(0, costMonths);
    const passiveMonthly = rentMonths.length ? rentMonths.reduce((s, m) => s + (rentByMonth.get(m) ?? 0), 0) / rentMonths.length : 0;
    const passiveAnnual = isEligible(CLASS.imoveis) ? 0 : passiveMonthly * 12;
    const netAnnualCost = Math.max(0, annualCost - passiveAnnual);

    // Núcleo FIRE (reuso) sobre o custo LÍQUIDO.
    const swr = proj.withdrawalRate;
    const independenceNumber = fireNumber(netAnnualCost, swr); // 0 se coberto; Infinity se swr ≤ 0
    // Pronto só com base sólida: custo > 0 E (já coberto pela renda OU alvo finito — taxa > 0).
    const ready = annualCost > 0 && (netAnnualCost <= 0 || Number.isFinite(independenceNumber));
    const coveredByPassive = ready && netAnnualCost <= 0; // a renda passiva já cobre o custo
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
      ready, disp, eligibleWealth, netWorth, monthlyCost, annualCost, costFromOverride,
      withdrawalRate: swr, independenceNumber, freedomPct, yearsOfFreedom, safeMonthly, coverage,
      remaining, reached, arrival, streak, reserve, milestones,
      passiveAnnual, netAnnualCost, coveredByPassive,
    };
  }, [pat, budget, settings, proj, disp, base, rates]);
}
