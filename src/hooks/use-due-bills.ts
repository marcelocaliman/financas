import { useMemo } from "react";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { convert, type Currency } from "@/money/currency";
import { upcomingBills, todayISO, type UpcomingBill } from "@/domain/bills";

export interface DueBills {
  /** Vencidas (dia < hoje) — o caso que precisa GRITAR (barra vermelha). */
  overdue: UpcomingBill[];
  /** A vencer em breve (hoje/≤3d, ainda não vencidas) — aviso calmo (badge). */
  soon: UpcomingBill[];
  /** Tudo que pede ação = vencidas + a vencer em breve. */
  actionable: UpcomingBill[];
  overdueTotal: number;
  actionableTotal: number;
  overdueCount: number;
  /** Contagem acionável (vencidas + a vencer) — vira o badge do "Orçamento". */
  count: number;
  disp: Currency;
}

/**
 * Fonte ÚNICA das contas que pedem atenção: vencidas + a vencer em ≤3 dias (janela curta,
 * diferente do planejamento de 45d do Orçamento). Consumida pela barra de alerta (só vencidas),
 * pelo badge do "Orçamento" (tudo acionável) e por qualquer outro relance — sem recalcular.
 */
export function useDueBills(): DueBills {
  const disp = useUI((s) => s.displayCurrency);
  const rates = useRates((s) => s.rates);
  const { data } = useDashboardData();
  return useMemo(() => {
    if (!data) {
      return { overdue: [], soon: [], actionable: [], overdueTotal: 0, actionableTotal: 0, overdueCount: 0, count: 0, disp };
    }
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const bills = upcomingBills(data.expenses, todayISO(), 3);
    const overdue = bills.filter((b) => b.status === "overdue");
    const soon = bills.filter((b) => b.status !== "overdue");
    const sum = (arr: UpcomingBill[]) => arr.reduce((s, b) => s + conv(b.amount, b.currency), 0);
    return {
      overdue,
      soon,
      actionable: bills,
      overdueTotal: sum(overdue),
      actionableTotal: sum(bills),
      overdueCount: overdue.length,
      count: bills.length,
      disp,
    };
  }, [data, disp, rates]);
}
