import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  AssetType,
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
};

export async function getPortfolioStats(): Promise<PortfolioStats> {
  const supabase = await createClient();
  const [{ data: invs }, { data: yields }] = await Promise.all([
    supabase.from("investments").select("*").eq("is_active", true),
    supabase
      .from("investment_yields")
      .select("net_yield, month")
      .gte("month", new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
  ]);

  const investments = (invs ?? []) as Tables<"investments">[];
  const total = investments.reduce((s, i) => s + Number(i.current_balance ?? 0), 0);
  const invested = investments.reduce((s, i) => s + Number(i.initial_amount ?? 0), 0);
  const yieldRows = yields ?? [];
  const totalYield = yieldRows.reduce((s, y) => s + Number(y.net_yield ?? 0), 0);
  const months = new Set(yieldRows.map((y) => (y.month as string).slice(0, 7))).size;
  const monthlyAverage = months > 0 ? totalYield / months : 0;
  const dyAnnualized = total > 0 ? (monthlyAverage * 12) / total : 0;

  // "Live" = primeiro ativo indexado à Selic com saldo > 0
  const live = investments
    .filter((i) => i.indexer === "selic" && Number(i.current_balance) > 0)
    .sort((a, b) => Number(b.current_balance) - Number(a.current_balance))[0] ?? null;

  return {
    total: Math.round(total * 100) / 100,
    invested: Math.round(invested * 100) / 100,
    monthlyAverage: Math.round(monthlyAverage * 100) / 100,
    dyAnnualized,
    liveAsset: (live as Investment | null) ?? null,
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
}> {
  const supabase = await createClient();
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, 1))
    .toISOString()
    .slice(0, 10);
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))
    .toISOString()
    .slice(0, 10);

  const [{ data: expenses }, { data: yields }] = await Promise.all([
    supabase
      .from("transactions")
      .select("amount, date")
      .eq("kind", "expense")
      .gte("date", start)
      .lte("date", end),
    supabase
      .from("investment_yields")
      .select("net_yield, month")
      .gte("month", start)
      .lte("month", end),
  ]);

  const monthlyExpenseTotal = (expenses ?? []).reduce(
    (s, t) => s + Number(t.amount),
    0,
  );
  const monthlyYieldTotal = (yields ?? []).reduce(
    (s, y) => s + Number(y.net_yield),
    0,
  );
  const months = 3;
  const monthlyAverageExpense = monthlyExpenseTotal / months;
  const monthlyAverageYield = monthlyYieldTotal / months;
  const ratio =
    monthlyAverageExpense > 0 ? monthlyAverageYield / monthlyAverageExpense : 0;

  return {
    monthlyAverageExpense: Math.round(monthlyAverageExpense * 100) / 100,
    monthlyAverageYield: Math.round(monthlyAverageYield * 100) / 100,
    ratio,
  };
}
