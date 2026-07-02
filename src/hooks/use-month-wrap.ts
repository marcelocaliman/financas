import { useMemo } from "react";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useTaxonomy } from "@/hooks/use-taxonomy";
import { convert, type Currency } from "@/money/currency";
import { expenseTotal, expenseLeaves } from "@/finance/statement";
import { nameById } from "@/domain/taxonomy";

export interface MonthWrap {
  /** "AAAA-MM" do mês FECHADO (o anterior ao atual). */
  month: string;
  /** Mês atual "AAAA-MM" — pra o gatilho "1× por mês". */
  currentMonth: string;
  hasData: boolean;
  totalInc: number;
  totalExp: number;
  saved: number;
  savingsRate: number; // % do que entrou
  topCategory: { name: string; value: number } | null;
  nwChangePct: number | null; // variação do patrimônio no mês
  nwChangeAbs: number | null;
}

const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** Resumo do MÊS ANTERIOR (o "fechamento"): variação do patrimônio, poupança e maior gasto. */
export function useMonthWrap(): MonthWrap | null {
  const disp = useUI((s) => s.displayCurrency);
  const rates = useRates((s) => s.rates);
  const { data } = useDashboardData();
  const tax = useTaxonomy();
  return useMemo(() => {
    if (!data) return null;
    const now = new Date();
    const currentMonth = ym(now);
    const month = ym(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);

    const monthExp = data.expenses.filter((e) => e.month === month);
    const monthInc = data.incomes.filter((i) => i.month === month);
    const totalExp = expenseTotal(monthExp, disp, rates);
    const totalInc = monthInc.reduce((s, i) => s + conv(i.amount, i.currency), 0);
    const saved = totalInc - totalExp;
    const savingsRate = totalInc > 0 ? (saved / totalInc) * 100 : 0;

    // Maior categoria de gasto (desmembra faturas via expenseLeaves — sem dupla contagem).
    const byCat = new Map<string, number>();
    for (const l of expenseLeaves(monthExp, rates)) byCat.set(l.categoryId, (byCat.get(l.categoryId) ?? 0) + conv(l.amount, l.currency));
    const top = [...byCat.entries()]
      .map(([id, value]) => ({ name: nameById(tax.expenseCategories, id) || "", value }))
      .sort((a, b) => b.value - a.value)[0];

    // Variação do patrimônio: snapshot do mês vs o snapshot anterior a ele.
    const snaps = [...data.snapshots].sort((a, b) => a.month.localeCompare(b.month));
    const idx = snaps.findIndex((s) => s.month === month);
    let nwChangePct: number | null = null;
    let nwChangeAbs: number | null = null;
    if (idx > 0) {
      const cur = conv(snaps[idx].amount, snaps[idx].currency);
      const prev = conv(snaps[idx - 1].amount, snaps[idx - 1].currency);
      nwChangeAbs = cur - prev;
      nwChangePct = prev !== 0 ? ((cur - prev) / prev) * 100 : null;
    }

    const hasData = monthInc.length > 0 || monthExp.length > 0 || idx >= 0;
    return {
      month,
      currentMonth,
      hasData,
      totalInc,
      totalExp,
      saved,
      savingsRate,
      topCategory: top && top.value > 0 ? top : null,
      nwChangePct,
      nwChangeAbs,
    };
  }, [data, disp, rates, tax]);
}
