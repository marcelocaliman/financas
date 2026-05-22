import "server-only";
import { createClient } from "@/lib/supabase/server";
import { fetchQuotes, isB3Ticker, type Quote } from "@/lib/financial/brapi";
import {
  computeLivePortfolio,
  type LiveInvestmentInput,
  type LivePortfolio,
} from "@/lib/financial/live-yield";
import type { IndexerCode } from "@/types/database";

/**
 * Agrega tudo o que o cálculo ao vivo precisa: ativos ativos, últimos
 * indexadores, soma de yields dos últimos 12 meses por ativo, cotações brapi.
 */
export async function getLivePortfolio(): Promise<LivePortfolio> {
  const supabase = await createClient();

  // ---------- Ativos ativos
  const { data: investmentsData } = await supabase
    .from("investments")
    .select(
      "id, ticker, name, asset_type, indexer, indexer_multiplier, fixed_rate, current_balance, initial_amount, quantity, purchase_date, last_yield_at",
    )
    .eq("is_active", true);
  const investments = (investmentsData ?? []) as LiveInvestmentInput[];

  if (investments.length === 0) {
    return {
      totalBaseBalance: 0,
      totalMarketBalance: 0,
      totalDailyYield: 0,
      totalPerSecond: 0,
      byAsset: [],
      byClass: {
        fixedIncome: { dailyYield: 0, perSecond: 0, balance: 0 },
        fiis: { dailyYield: 0, perSecond: 0, balance: 0 },
        stocks: { dailyYield: 0, perSecond: 0, balance: 0 },
        other: { dailyYield: 0, perSecond: 0, balance: 0 },
      },
    };
  }

  // ---------- Últimos indexadores
  const { data: idxData } = await supabase
    .from("indexer_history")
    .select("indexer, value, date")
    .order("date", { ascending: false });
  const indexers: Record<IndexerCode, number | null> = {
    selic: null,
    cdi: null,
    ipca: null,
  };
  for (const row of idxData ?? []) {
    const k = row.indexer as IndexerCode;
    if (indexers[k] == null) indexers[k] = Number(row.value);
  }

  // ---------- Yields dos últimos 12 meses
  const start = new Date();
  start.setUTCMonth(start.getUTCMonth() - 12);
  const startISO = start.toISOString().slice(0, 10);
  const { data: yieldsData } = await supabase
    .from("investment_yields")
    .select("investment_id, net_yield, month")
    .gte("month", startISO);

  const yields12m = new Map<string, { totalNet: number; months: number }>();
  for (const y of yieldsData ?? []) {
    const acc = yields12m.get(y.investment_id) ?? { totalNet: 0, months: 0 };
    acc.totalNet += Number(y.net_yield);
    acc.months += 1;
    yields12m.set(y.investment_id, acc);
  }

  // ---------- Cotações via brapi para tickers da B3
  const tickers = investments
    .filter((i) => isB3Ticker(i.ticker))
    .map((i) => i.ticker);
  const quotes: Map<string, Quote> = tickers.length > 0 ? await fetchQuotes(tickers) : new Map();

  return computeLivePortfolio({
    investments,
    indexers,
    yields12mByInvestmentId: yields12m,
    quotes,
  });
}
