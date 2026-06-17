import { useMemo } from "react";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { useBudget } from "@/hooks/use-budget";
import { useObjetivos } from "@/hooks/use-objetivos";
import { useLiberdade, LIBERDADE_DEFAULTS } from "@/hooks/use-liberdade";
import { useSettings } from "@/hooks/use-settings";
import { convert, type Currency } from "@/money/currency";
import { isInvestedClass } from "@/domain/taxonomy";
import {
  savingsScore,
  diversificationScore,
  reserveScore,
  debtScore,
  goalsScore,
  compositeHealth,
  DEFAULT_HEALTH_WEIGHTS,
  DEFAULT_SAVINGS_TARGET,
  DEFAULT_MAX_DEBT_RATIO,
  HEALTH_DIMS,
  type HealthDim,
  type HealthParts,
} from "@/finance/health";

/** Janela (meses) p/ a taxa de poupança da saúde. */
const SAVINGS_WINDOW = 6;

export interface HealthDimView {
  dim: HealthDim;
  value: number | null; // 0..1 ou null (sem dados)
  weight: number;
}
export interface HealthView {
  score: number | null; // 0..100
  dims: HealthDimView[];
  ready: boolean;
}

/**
 * Score de saúde financeira: poupança + diversificação + reserva + dívida + progresso de metas.
 * Cada dimensão 0..1 (null se sem dados); composto = média ponderada (pesos do usuário). Reusa
 * Orçamento, Patrimônio, Objetivos e a reserva da Liberdade. Tudo na moeda de exibição.
 */
export function useHealth(): HealthView | null {
  const disp = useUI((s) => s.displayCurrency);
  const rates = useRates((s) => s.rates);
  const pat = usePatrimonio();
  const budget = useBudget();
  const goals = useObjetivos();
  const lib = useLiberdade();
  const settings = useSettings();

  return useMemo(() => {
    if (!pat || !budget || goals == null || !lib) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const hcfg = settings.health ?? {};
    const weights = Object.fromEntries(
      HEALTH_DIMS.map((d) => [d, hcfg.weights?.[d] ?? DEFAULT_HEALTH_WEIGHTS[d]]),
    ) as Record<HealthDim, number>;

    // Poupança: (receitas − gastos) ÷ receitas nos últimos N meses.
    const incByMonth = new Map<string, number>();
    const expByMonth = new Map<string, number>();
    for (const i of budget.incomes) incByMonth.set(i.month, (incByMonth.get(i.month) ?? 0) + conv(i.amount, i.currency));
    for (const e of budget.expenses) expByMonth.set(e.month, (expByMonth.get(e.month) ?? 0) + conv(e.amount, e.currency));
    const months = [...new Set([...incByMonth.keys(), ...expByMonth.keys()])]
      .sort((a, b) => b.localeCompare(a))
      .slice(0, SAVINGS_WINDOW);
    let inc = 0;
    let exp = 0;
    for (const m of months) {
      inc += incByMonth.get(m) ?? 0;
      exp += expByMonth.get(m) ?? 0;
    }
    const savingsTarget = hcfg.savingsTarget ?? DEFAULT_SAVINGS_TARGET;
    const savings = inc > 0 ? savingsScore(((inc - exp) / inc) * 100, savingsTarget) : null;

    // Diversificação: ativos INVESTIDOS por classe (HHI).
    const byClass = new Map<string, number>();
    for (const a of pat.assets) {
      if (isInvestedClass(a.classId)) byClass.set(a.classId, (byClass.get(a.classId) ?? 0) + conv(a.amount, a.currency));
    }
    const diversification = byClass.size > 0 ? diversificationScore([...byClass.values()]) : null;

    // Reserva: meses cobertos (da Liberdade) ÷ meses-alvo.
    const reserveMonths = Math.max(1, Math.round(settings.liberdade?.reserveMonths ?? LIBERDADE_DEFAULTS.reserveMonths));
    const reserve = lib.ready && lib.monthlyCost > 0 ? reserveScore(lib.reserve.monthsCovered, reserveMonths) : null;

    // Dívida: passivos ÷ ativos.
    const assets = pat.assets.reduce((s, a) => s + conv(a.amount, a.currency), 0);
    const liab = pat.liabilities.reduce((s, l) => s + conv(l.amount, l.currency), 0);
    const maxDebtRatio = hcfg.maxDebtRatio ?? DEFAULT_MAX_DEBT_RATIO;
    const debt = assets > 0 ? debtScore((liab / assets) * 100, maxDebtRatio) : liab > 0 ? 0 : null;

    // Metas: progresso médio.
    const goalsAvg = goals.length > 0
      ? goals.reduce((s, g) => {
          const tt = conv(g.target, g.currency);
          const cc = conv(g.current, g.currency);
          return s + (tt > 0 ? Math.min(100, (cc / tt) * 100) : 0);
        }, 0) / goals.length
      : null;
    const goalsV = goalsAvg == null ? null : goalsScore(goalsAvg);

    const parts: HealthParts = { savings, diversification, reserve, debt, goals: goalsV };
    const score = compositeHealth(parts, weights);
    const dims: HealthDimView[] = HEALTH_DIMS.map((dim) => ({ dim, value: parts[dim], weight: weights[dim] }));
    return { score, dims, ready: score != null };
  }, [pat, budget, goals, lib, settings, disp, rates]);
}
