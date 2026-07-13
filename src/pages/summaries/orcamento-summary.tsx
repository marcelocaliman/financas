import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useBudgetMonth } from "@/store/budget-month";
import { useBudget } from "@/hooks/use-budget";
import { convert, type Currency } from "@/money/currency";
import { expenseTotal } from "@/finance/statement";
import { upcomingBills, todayISO } from "@/domain/bills";
import { Money } from "@/components/common/money";
import { HeaderKpis, HeaderKpi } from "@/components/common/header-kpis";

const LANG_LOCALE: Record<string, string> = { pt: "pt-BR", en: "en-US", it: "it-IT" };
/** "AAAA-MM" → nome curto do mês no idioma corrente (rótulo do KPI de mês). */
function monthShort(month: string, lang: string): string {
  const [y, mm] = month.split("-").map(Number);
  return new Date(y, mm - 1, 1).toLocaleDateString(LANG_LOCALE[lang] ?? "pt-BR", { month: "short" });
}

/** KPIs do cabeçalho do accordion de Orçamento — sempre o MÊS CORRENTE. Vive FORA da página
 *  (que é lazy/code-split): renderiza sempre no header do accordion. */
export function OrcamentoSummary() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? "pt";
  const disp = useUI((s) => s.displayCurrency);
  const rates = useRates((s) => s.rates);
  const data = useBudget();
  const month = useBudgetMonth((s) => s.month); // sincronizado com o seletor da página
  const v = useMemo(() => {
    if (!data) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const mo = month;
    const totalExp = expenseTotal(data.expenses.filter((e) => e.month === mo), disp, rates); // só top-level (bate com a tabela)
    const totalInc = data.incomes.filter((i) => i.month === mo).reduce((s, i) => s + conv(i.amount, i.currency), 0);
    const saldo = totalInc - totalExp;
    const bills = upcomingBills(data.expenses, todayISO()).filter((b) => b.month === mo);
    const duePayable = bills.reduce((s, b) => s + conv(b.amount, b.currency), 0);
    return { totalExp, totalInc, saldo, savingsRate: totalInc > 0 ? (saldo / totalInc) * 100 : 0, duePayable, dueCount: bills.length };
  }, [data, disp, rates, month]);
  if (!v) return null;
  const ml = monthShort(month, lang).replace(/\.$/, "");
  const monthLbl = `${ml.charAt(0).toUpperCase()}${ml.slice(1)} ${month.slice(0, 4)}`;
  return (
    <HeaderKpis>
      <HeaderKpi raw label={t("historico.month")} value={monthLbl} />
      <HeaderKpi label={t("orcamento.balance")} tone={v.saldo >= 0 ? "text" : "neg"} value={<Money value={v.saldo} currency={disp} />} />
      {v.totalInc > 0 ? (
        <HeaderKpi secondary label={t("orcamento.savingsRate")} tone={v.savingsRate >= 0 ? "accent" : "neg"} value={`${Math.round(v.savingsRate)}%`} />
      ) : null}
      <HeaderKpi secondary label={t("orcamento.income")} tone="accent" value={<Money value={v.totalInc} currency={disp} />} />
      <HeaderKpi secondary label={t("orcamento.expenses")} tone="neg" value={<Money value={v.totalExp} currency={disp} options={{ signDisplay: "never" }} />} />
      {v.dueCount > 0 ? (
        <HeaderKpi secondary label={t("orcamento.duePayable")} tone="neg" value={<Money value={v.duePayable} currency={disp} options={{ signDisplay: "never" }} />} />
      ) : null}
    </HeaderKpis>
  );
}
