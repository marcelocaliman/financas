import { useMemo } from "react";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useProjection } from "@/store/projection";
import { useBudget } from "@/hooks/use-budget";
import { useSettings } from "@/hooks/use-settings";
import { convert, type Currency } from "@/money/currency";
import { CLASS, defaultEligibleClass } from "@/domain/taxonomy";
import { fireNumber } from "@/finance/fire";

/** Default da janela de custo (meses) — usado também pelo Config da Liberdade. */
export const FIRE_DEFAULTS = { costMonths: 6 };

export interface FireTarget {
  /** Tem base suficiente p/ a métrica fazer sentido (custo > 0 e alvo finito ou já coberto). */
  ready: boolean;
  disp: Currency;
  /** Custo anual BRUTO (override em valor OU média móvel dos últimos N meses × 12). */
  annualCost: number;
  monthlyCost: number;
  costFromOverride: boolean;
  /** Renda passiva durável anual descontável (aluguel; 0 se Imóveis conta como patrimônio). */
  passiveAnnual: number;
  /** Custo anual LÍQUIDO que a carteira precisa cobrir = max(0, bruto − passiva). */
  netAnnualCost: number;
  withdrawalRate: number;
  /** Número da Independência = fireNumber(netAnnualCost, taxa). 0 se coberto; Infinity se taxa ≤ 0. */
  independenceNumber: number;
  /** A renda passiva já cobre todo o custo (independência via renda, sem precisar de carteira). */
  coveredByPassive: boolean;
}

/**
 * Número da Independência (FIRE) — FONTE ÚNICA compartilhada por Liberdade, Projeção e o
 * relatório mensal, pra os três mostrarem EXATAMENTE o mesmo número.
 *
 * = (custo anual − renda passiva durável) ÷ taxa de retirada. Custo anual = média móvel dos
 * últimos N meses COM lançamento × 12 (ou o valor informado à mão). Renda passiva (aluguel)
 * abate o custo — a carteira só precisa cobrir o líquido; se o usuário inclui Imóveis na
 * elegibilidade, o aluguel NÃO é descontado (senão o imóvel contaria duas vezes). Tudo na
 * moeda de exibição e em MOEDA DE HOJE (coerente com fire.ts).
 */
export function useFireTarget(): FireTarget | null {
  const disp = useUI((s) => s.displayCurrency);
  const rates = useRates((s) => s.rates);
  const budget = useBudget();
  const settings = useSettings();
  const proj = useProjection();

  return useMemo(() => {
    if (!budget) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const cfg = settings.liberdade ?? {};
    const eligibleClasses = cfg.eligibleClasses ?? {};
    const isEligible = (classId: string) => eligibleClasses[classId] ?? defaultEligibleClass(classId);

    // Custo de vida: média móvel dos últimos N meses COM lançamento (ou valor-alvo informado).
    const costMonths = Math.max(1, Math.round(cfg.costMonths ?? FIRE_DEFAULTS.costMonths));
    const expByMonth = new Map<string, number>();
    for (const e of budget.expenses) expByMonth.set(e.month, (expByMonth.get(e.month) ?? 0) + conv(e.amount, e.currency));
    const recentMonths = [...expByMonth.keys()].sort((a, b) => b.localeCompare(a)).slice(0, costMonths);
    const movingMonthlyCost = recentMonths.length
      ? recentMonths.reduce((s, m) => s + (expByMonth.get(m) ?? 0), 0) / recentMonths.length
      : 0;
    const costFromOverride = proj.annualExpensesOverride != null;
    const annualCost = costFromOverride ? proj.annualExpensesOverride! : movingMonthlyCost * 12;
    const monthlyCost = annualCost / 12;

    // Renda passiva EXTERNA (default: aluguel) abate o custo. Dividendos/juros NÃO entram (vêm
    // da carteira contada; a regra dos 4% já os assume).
    const passiveCats = new Set(cfg.passiveCategories ?? ["aluguel"]);
    const rentByMonth = new Map<string, number>();
    for (const i of budget.incomes) {
      if (passiveCats.has(i.categoryId)) rentByMonth.set(i.month, (rentByMonth.get(i.month) ?? 0) + conv(i.amount, i.currency));
    }
    const rentMonths = [...rentByMonth.keys()].sort((a, b) => b.localeCompare(a)).slice(0, costMonths);
    const passiveMonthly = rentMonths.length ? rentMonths.reduce((s, m) => s + (rentByMonth.get(m) ?? 0), 0) / rentMonths.length : 0;
    const passiveAnnual = isEligible(CLASS.imoveis) ? 0 : passiveMonthly * 12;
    const netAnnualCost = Math.max(0, annualCost - passiveAnnual);

    const withdrawalRate = proj.withdrawalRate;
    const independenceNumber = fireNumber(netAnnualCost, withdrawalRate); // 0 se coberto; Infinity se taxa ≤ 0
    const ready = annualCost > 0 && (netAnnualCost <= 0 || Number.isFinite(independenceNumber));
    const coveredByPassive = ready && netAnnualCost <= 0;

    return {
      ready, disp, annualCost, monthlyCost, costFromOverride,
      passiveAnnual, netAnnualCost, withdrawalRate, independenceNumber, coveredByPassive,
    };
  }, [budget, settings, proj, disp, rates]);
}
