import "server-only";
import { createClient } from "@/lib/supabase/server";
import { fetchQuotes, isB3Ticker, type Quote } from "@/lib/financial/brapi";
import {
  computeLivePortfolio,
  type LiveInvestmentInput,
  type LivePortfolio,
} from "@/lib/financial/live-yield";
import { convertOrSame } from "@/lib/financial/currency";
import { getDisplayCurrency, getRateMap } from "@/services/currency";
import type { Currency, IndexerCode } from "@/types/database";

type InvestmentRow = LiveInvestmentInput & { currency: Currency };

/**
 * Agrega tudo o que o cálculo ao vivo precisa: ativos ativos, últimos
 * indexadores, soma de yields dos últimos 12 meses por ativo, cotações brapi.
 *
 * Todos os valores monetários são convertidos para a moeda de exibição do
 * usuário antes do cálculo. Cotações brapi (B3 = BRL) são convertidas
 * conforme a moeda nativa de cada ativo.
 */
export async function getLivePortfolio(): Promise<LivePortfolio & { displayCurrency: Currency }> {
  const supabase = await createClient();
  const [displayCurrency, rates] = await Promise.all([getDisplayCurrency(), getRateMap()]);

  // ---------- Ativos ativos
  const { data: investmentsData } = await supabase
    .from("investments")
    .select(
      "id, ticker, name, asset_type, indexer, indexer_multiplier, fixed_rate, current_balance, initial_amount, quantity, purchase_date, last_yield_at, currency",
    )
    .eq("is_active", true);
  const raw = (investmentsData ?? []) as InvestmentRow[];

  // Converte balanços para a moeda de exibição
  const investments: LiveInvestmentInput[] = raw.map((i) => ({
    ...i,
    current_balance: convertOrSame(
      Number(i.current_balance ?? 0),
      i.currency ?? "BRL",
      displayCurrency,
      rates,
    ),
    initial_amount: convertOrSame(
      Number(i.initial_amount ?? 0),
      i.currency ?? "BRL",
      displayCurrency,
      rates,
    ),
  }));

  if (investments.length === 0) {
    return {
      totalBaseBalance: 0,
      totalMarketBalance: 0,
      totalDailyYield: 0,
      totalPerSecond: 0,
      totalFixedIncomeAccumulatedYield: 0,
      isBusinessDayToday: true,
      byAsset: [],
      byClass: {
        fixedIncome: { dailyYield: 0, perSecond: 0, balance: 0 },
        fiis: { dailyYield: 0, perSecond: 0, balance: 0 },
        stocks: { dailyYield: 0, perSecond: 0, balance: 0 },
        other: { dailyYield: 0, perSecond: 0, balance: 0 },
      },
      displayCurrency,
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
  const rawQuotes: Map<string, Quote> =
    tickers.length > 0 ? await fetchQuotes(tickers) : new Map();
  // Brapi sempre retorna em BRL (B3). Converte pra moeda de exibição.
  const factor = convertOrSame(1, "BRL", displayCurrency, rates);
  const quotes: Map<string, Quote> = new Map();
  for (const [ticker, q] of rawQuotes) {
    quotes.set(ticker, {
      ...q,
      regularMarketPrice: q.regularMarketPrice * factor,
    });
  }

  return {
    ...computeLivePortfolio({
      investments,
      indexers,
      yields12mByInvestmentId: yields12m,
      quotes,
    }),
    displayCurrency,
  };
}
