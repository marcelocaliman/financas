import { useMemo } from "react";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useProjection } from "@/store/projection";
import { usePatrimonio } from "@/hooks/use-patrimonio";
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
  /** Custo anual BRUTO de PLANEJAMENTO usado no número FIRE = custo-alvo na independência (se
   *  o usuário definiu um) OU o do orçamento (média móvel dos últimos N meses × 12). */
  annualCost: number;
  monthlyCost: number;
  /** True se há um custo-alvo definido (diferente do orçamento atual). */
  costFromTarget: boolean;
  /** Custo de vida ATUAL do orçamento (média móvel) — referência; sempre calculado. */
  budgetMonthlyCost: number;
  budgetAnnualCost: number;
  /** Renda passiva durável anual descontável (aluguel; 0 se Imóveis conta como patrimônio). */
  passiveAnnual: number;
  /** Custo anual LÍQUIDO que a carteira precisa cobrir = max(0, bruto − passiva). */
  netAnnualCost: number;
  withdrawalRate: number;
  /** Número da Independência = fireNumber(netAnnualCost, taxa). 0 se coberto; Infinity se taxa ≤ 0. */
  independenceNumber: number;
  /** A renda passiva já cobre todo o custo (independência via renda, sem precisar de carteira). */
  coveredByPassive: boolean;
  /** Patrimônio líquido TOTAL (ativos − passivos). */
  netWorth: number;
  /** Patrimônio INVESTÍVEL/elegível (classes ligadas − passivos) — base do % e do tempo até a IF.
   *  A regra dos 4% só vale sobre o que dá pra sacar (a casa/bens não financiam a retirada). */
  eligibleWealth: number;
  /** Caixa (classe "caixa") — p/ a reserva de emergência. */
  cash: number;
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
  const base = useUI((s) => s.baseCurrency);
  const rates = useRates((s) => s.rates);
  const pat = usePatrimonio();
  const budget = useBudget();
  const settings = useSettings();
  const proj = useProjection();

  return useMemo(() => {
    if (!budget || !pat) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const cfg = settings.liberdade ?? {};
    const eligibleClasses = cfg.eligibleClasses ?? {};
    const isEligible = (classId: string) => eligibleClasses[classId] ?? defaultEligibleClass(classId);

    // Patrimônio: total, INVESTÍVEL (classes elegíveis) e caixa — todos − passivos.
    const assetsTotal = pat.assets.reduce((s, a) => s + conv(a.amount, a.currency), 0);
    const assetsEligible = pat.assets.reduce((s, a) => (isEligible(a.classId) ? s + conv(a.amount, a.currency) : s), 0);
    const liabilities = pat.liabilities.reduce((s, l) => s + conv(l.amount, l.currency), 0);
    const netWorth = assetsTotal - liabilities;
    const eligibleWealth = assetsEligible - liabilities;
    const cash = pat.assets.reduce((s, a) => (a.classId === CLASS.caixa ? s + conv(a.amount, a.currency) : s), 0);

    // Custo de vida ATUAL (do orçamento): média móvel dos últimos N meses COM lançamento.
    const costMonths = Math.max(1, Math.round(cfg.costMonths ?? FIRE_DEFAULTS.costMonths));
    const expByMonth = new Map<string, number>();
    for (const e of budget.expenses) expByMonth.set(e.month, (expByMonth.get(e.month) ?? 0) + conv(e.amount, e.currency));
    const recentMonths = [...expByMonth.keys()].sort((a, b) => b.localeCompare(a)).slice(0, costMonths);
    const budgetMonthlyCost = recentMonths.length
      ? recentMonths.reduce((s, m) => s + (expByMonth.get(m) ?? 0), 0) / recentMonths.length
      : 0;
    const budgetAnnualCost = budgetMonthlyCost * 12;

    // Custo de PLANEJAMENTO (o que o FIRE mira): o custo-alvo na independência, se o usuário
    // definiu um (guardado em moeda PRINCIPAL → converte p/ exibição); senão, o do orçamento.
    // Permite mirar num custo FUTURO diferente do de hoje (ex.: quando sair de casa) — vale pra
    // qualquer cenário de qualquer usuário; quem não define, segue no custo atual.
    const targetSet = (cfg.targetMonthlyCost ?? 0) > 0;
    const monthlyCost = targetSet ? convert(cfg.targetMonthlyCost!, base, disp, rates) : budgetMonthlyCost;
    const annualCost = monthlyCost * 12;
    const costFromTarget = targetSet;

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
      ready, disp, annualCost, monthlyCost, costFromTarget, budgetMonthlyCost, budgetAnnualCost,
      passiveAnnual, netAnnualCost, withdrawalRate, independenceNumber, coveredByPassive,
      netWorth, eligibleWealth, cash,
    };
  }, [pat, budget, settings, proj, disp, base, rates]);
}
