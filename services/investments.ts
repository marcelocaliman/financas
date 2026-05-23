import "server-only";
import { createClient } from "@/lib/supabase/server";
import { convertOrSame } from "@/lib/financial/currency";
import { getDisplayCurrency, getRateMap } from "@/services/currency";
import { getLivePortfolio } from "@/services/live-yield";
import type {
  AssetType,
  Currency,
  IndexerCode,
  Tables,
} from "@/types/database";

export type Investment = Tables<"investments"> & {
  account?: Pick<Tables<"accounts">, "id" | "name" | "institution"> | null;
};

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  fii: "FII",
  fixed_income_public: "Renda fixa · pública",
  fixed_income_private: "Renda fixa · privada",
  stock: "Ação",
  etf: "ETF",
  crypto: "Cripto",
};

export async function listInvestments(): Promise<Investment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("investments")
    .select("*, account:accounts(id,name,institution)")
    .eq("is_active", true)
    .order("current_balance", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Investment[];
}

export async function getInvestment(id: string): Promise<Investment | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("investments")
    .select("*, account:accounts(id,name,institution)")
    .eq("id", id)
    .maybeSingle();
  return (data as Investment) ?? null;
}

export async function getLatestIndexer(code: IndexerCode): Promise<{
  value: number;
  date: string;
} | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("indexer_history")
    .select("value, date")
    .eq("indexer", code)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { value: Number(data.value), date: data.date };
}

export type PortfolioStats = {
  total: number;
  invested: number;
  monthlyAverage: number;
  dyAnnualized: number;
  liveAsset: Investment | null;
  displayCurrency: Currency;
};

export async function getPortfolioStats(): Promise<PortfolioStats> {
  const supabase = await createClient();
  const [{ data: invs }, { data: yields }, displayCurrency, rates, live] =
    await Promise.all([
      supabase.from("investments").select("*").eq("is_active", true),
      supabase
        .from("investment_yields")
        .select("net_yield, month, investment:investments(currency)")
        .gte("month", new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
      getDisplayCurrency(),
      getRateMap(),
      getLivePortfolio(),
    ]);

  const investments = (invs ?? []) as Tables<"investments">[];
  // `total` agora vem direto do live (compounding RF + market price brapi
  // pra variável). É o MESMO número exibido em /investimentos, garantindo
  // consistência total entre as páginas. Antes era sum(current_balance) raw
  // que ficava 24h+ stale entre runs do cron.
  const total = live.totalMarketBalance;
  const invested = investments.reduce(
    (s, i) =>
      s + convertOrSame(Number(i.initial_amount ?? 0), i.currency ?? "BRL", displayCurrency, rates),
    0,
  );
  const yieldRows = (yields ?? []) as Array<{
    net_yield: number;
    month: string;
    investment: { currency: Currency } | { currency: Currency }[] | null;
  }>;
  const totalYield = yieldRows.reduce((s, y) => {
    const inv = Array.isArray(y.investment) ? y.investment[0] : y.investment;
    const c = (inv?.currency ?? "BRL") as Currency;
    return s + convertOrSame(Number(y.net_yield ?? 0), c, displayCurrency, rates);
  }, 0);
  const months = new Set(yieldRows.map((y) => y.month.slice(0, 7))).size;
  const monthlyAverage = months > 0 ? totalYield / months : 0;
  const dyAnnualized = total > 0 ? (monthlyAverage * 12) / total : 0;

  // "Live" asset destacado = primeiro indexado à Selic com saldo > 0
  const liveAsset = investments
    .filter((i) => i.indexer === "selic" && Number(i.current_balance) > 0)
    .sort((a, b) => Number(b.current_balance) - Number(a.current_balance))[0] ?? null;

  return {
    total: Math.round(total * 100) / 100,
    invested: Math.round(invested * 100) / 100,
    monthlyAverage: Math.round(monthlyAverage * 100) / 100,
    dyAnnualized,
    liveAsset: (liveAsset as Investment | null) ?? null,
    displayCurrency,
  };
}

/**
 * Retorna a cobertura da renda passiva sobre as despesas fixas médias dos
 * últimos 3 meses. Considera APENAS despesas (não transferências).
 */
export async function getCoverage(): Promise<{
  monthlyAverageExpense: number;
  monthlyAverageYield: number;
  ratio: number;
  displayCurrency: Currency;
}> {
  const supabase = await createClient();
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, 1))
    .toISOString()
    .slice(0, 10);
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))
    .toISOString()
    .slice(0, 10);

  const [{ data: expenses }, { data: yields }, displayCurrency, rates] = await Promise.all([
    supabase
      .from("transactions")
      .select("amount_account, currency, date, account:accounts(currency)")
      .eq("kind", "expense")
      .gte("date", start)
      .lte("date", end),
    supabase
      .from("investment_yields")
      .select("net_yield, month, investment:investments(currency)")
      .gte("month", start)
      .lte("month", end),
    getDisplayCurrency(),
    getRateMap(),
  ]);

  const monthlyExpenseTotal = (expenses ?? []).reduce((s, t) => {
    const acc = Array.isArray(t.account) ? t.account[0] : t.account;
    const c = (acc?.currency ?? t.currency ?? "BRL") as Currency;
    return s + convertOrSame(Number(t.amount_account ?? 0), c, displayCurrency, rates);
  }, 0);
  const monthlyYieldTotal = (yields ?? []).reduce((s, y) => {
    const inv = Array.isArray(y.investment) ? y.investment[0] : y.investment;
    const c = (inv?.currency ?? "BRL") as Currency;
    return s + convertOrSame(Number(y.net_yield ?? 0), c, displayCurrency, rates);
  }, 0);
  const months = 3;
  const monthlyAverageExpense = monthlyExpenseTotal / months;
  const monthlyAverageYield = monthlyYieldTotal / months;
  const ratio =
    monthlyAverageExpense > 0 ? monthlyAverageYield / monthlyAverageExpense : 0;

  return {
    monthlyAverageExpense: Math.round(monthlyAverageExpense * 100) / 100,
    monthlyAverageYield: Math.round(monthlyAverageYield * 100) / 100,
    ratio,
    displayCurrency,
  };
}
