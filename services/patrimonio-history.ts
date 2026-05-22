import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getAccountsTotalsAt } from "@/services/accounts";
import { getPortfolioStats } from "@/services/investments";
import { getPhysicalAssetsTotals } from "@/services/physical-assets";
import { getMonthlyHistory } from "@/services/transactions";

/**
 * Histórico mensal do patrimônio líquido (últimos N meses).
 *
 * Estratégia em duas camadas:
 *  1. Snapshots reais: pra meses que têm `patrimonio_snapshots`, usamos
 *     o total gravado. Esses são pontos histórica corretos.
 *  2. Aproximação: meses sem snapshot fallback pro cálculo antigo
 *     (saldo retroativo das contas + valor atual de invest/bens).
 *
 * Idealmente o cron `/api/cron/snapshot-patrimonio` grava todo mês — depois de
 * 12 meses rodando, todo ponto vem do snapshot.
 */
export type PatrimonioPoint = {
  month: string; // YYYY-MM
  label: string;
  netWorth: number;
  fromSnapshot: boolean;
};

const LABELS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function lastDayISO(y: number, m: number): string {
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

export async function getPatrimonioHistory(months = 12): Promise<PatrimonioPoint[]> {
  const supabase = await createClient();
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  });
  const [yStr, mStr] = fmt.format(now).split("-");
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);

  // Lista de meses cronologicamente (mais antigo → mais recente)
  const monthEnds: { y: number; m: number; iso: string }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const yy = d.getUTCFullYear();
    const mm = d.getUTCMonth() + 1;
    monthEnds.push({ y: yy, m: mm, iso: lastDayISO(yy, mm) });
  }

  // Busca todos os snapshots no range — uma query só
  const rangeStart = monthEnds[0].iso;
  const rangeEnd = monthEnds[monthEnds.length - 1].iso;
  const { data: snapshots } = await supabase
    .from("patrimonio_snapshots")
    .select("month_end, total")
    .gte("month_end", rangeStart)
    .lte("month_end", rangeEnd);

  const snapshotByDate = new Map<string, number>();
  for (const s of snapshots ?? []) {
    snapshotByDate.set(s.month_end as string, Number(s.total));
  }

  // Os meses que precisam de fallback (sem snapshot)
  const monthsNeedingFallback = monthEnds.filter((me) => !snapshotByDate.has(me.iso));

  // Carrega portfolio + physical UMA VEZ (fallback usa valor atual)
  const needFallback = monthsNeedingFallback.length > 0;
  const [portfolio, physical] = needFallback
    ? await Promise.all([getPortfolioStats(), getPhysicalAssetsTotals()])
    : [null, null];

  // Para cada mês sem snapshot, pega saldo retroativo das contas
  const accountsByMonth = needFallback
    ? new Map<string, Awaited<ReturnType<typeof getAccountsTotalsAt>>>(
        await Promise.all(
          monthsNeedingFallback.map(
            async (me) =>
              [me.iso, await getAccountsTotalsAt(me.iso)] as const,
          ),
        ),
      )
    : new Map();

  return monthEnds.map((me) => {
    const snap = snapshotByDate.get(me.iso);
    if (snap != null) {
      return {
        month: `${me.y}-${String(me.m).padStart(2, "0")}`,
        label: LABELS[me.m - 1],
        netWorth: Math.round(snap * 100) / 100,
        fromSnapshot: true,
      };
    }
    const accs = accountsByMonth.get(me.iso);
    const netWorth = accs
      ? accs.liquidExcludingInvestmentCash + (portfolio?.total ?? 0) + (physical?.total ?? 0)
      : 0;
    return {
      month: `${me.y}-${String(me.m).padStart(2, "0")}`,
      label: LABELS[me.m - 1],
      netWorth: Math.round(netWorth * 100) / 100,
      fromSnapshot: false,
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
