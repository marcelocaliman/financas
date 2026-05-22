import "server-only";
import { getAccountsTotalsAt } from "@/services/accounts";
import { getPortfolioStats } from "@/services/investments";
import { getPhysicalAssetsTotals } from "@/services/physical-assets";
import { getMonthlyHistory } from "@/services/transactions";

/**
 * Histórico mensal aproximado do patrimônio líquido (últimos N meses).
 *
 * Estratégia:
 *  - Contas: usa `getAccountsTotalsAt(monthEnd)` que reverte transações
 *    futuras → saldo histórico real por mês.
 *  - Investimentos + bens físicos: usa valor ATUAL pra todos os pontos
 *    históricos (não temos snapshots diários ainda). Aproximação aceitável.
 *
 * Retorna pontos prontos pra sparkline: { month, label, netWorth }.
 */
export type PatrimonioPoint = {
  month: string; // YYYY-MM
  label: string;
  netWorth: number;
};

const LABELS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function lastDayISO(y: number, m: number): string {
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

export async function getPatrimonioHistory(months = 12): Promise<PatrimonioPoint[]> {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  });
  const [yStr, mStr] = fmt.format(now).split("-");
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);

  // Calcular últimos N meses
  const monthEnds: { y: number; m: number; iso: string }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const yy = d.getUTCFullYear();
    const mm = d.getUTCMonth() + 1;
    monthEnds.push({ y: yy, m: mm, iso: lastDayISO(yy, mm) });
  }

  // Carrega investimentos + bens físicos UMA VEZ (valor atual)
  const [portfolio, physical] = await Promise.all([
    getPortfolioStats(),
    getPhysicalAssetsTotals(),
  ]);

  // Pra cada mês, pega saldo retroativo das contas
  const accountsByMonth = await Promise.all(
    monthEnds.map((me) => getAccountsTotalsAt(me.iso)),
  );

  return monthEnds.map((me, i) => {
    const accs = accountsByMonth[i];
    const netWorth =
      accs.liquidExcludingInvestmentCash + portfolio.total + physical.total;
    return {
      month: `${me.y}-${String(me.m).padStart(2, "0")}`,
      label: LABELS[me.m - 1],
      netWorth: Math.round(netWorth * 100) / 100,
    };
  });
}

/**
 * Sobra histórica dos últimos 6 meses (income - expense).
 * Atalho que delega pra getMonthlyHistory.
 */
export async function getSobraHistory(months = 6) {
  const history = await getMonthlyHistory(months);
  return history.map((h) => ({
    month: h.month,
    label: h.label,
    net: h.net,
  }));
}
