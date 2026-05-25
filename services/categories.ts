import "server-only";
import { createClient } from "@/lib/supabase/server";
import { convertOrSame } from "@/lib/financial/currency";
import { getDisplayCurrency, getRateMap } from "@/services/currency";
import type { CategoryKind, Currency, Tables } from "@/types/database";

export type Category = Tables<"categories">;

export async function listCategories(opts?: {
  kind?: CategoryKind;
  includeArchived?: boolean;
}): Promise<Category[]> {
  const supabase = await createClient();
  let q = supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (opts?.kind) q = q.eq("kind", opts.kind);
  if (!opts?.includeArchived) q = q.eq("is_archived", false);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function getCategory(id: string): Promise<Category | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").eq("id", id).maybeSingle();
  return (data as Category) ?? null;
}

/**
 * Estatística agregada por categoria nos últimos N meses.
 *
 * Retorna, por category_id:
 *  - total: soma total no período (em displayCurrency)
 *  - monthlyAverage: média mensal
 *  - byMonth: array com totalizador de cada mês (cronológico) — útil pra sparkline
 *  - txCount: quantidade de lançamentos
 */
export type CategoryStats = {
  total: number;
  monthlyAverage: number;
  byMonth: number[]; // length = months (cronológico)
  txCount: number;
};

export async function getCategoryStats(months = 3): Promise<Map<string, CategoryStats>> {
  const supabase = await createClient();
  const now = new Date();
  const startDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1),
  );
  const startISO = startDate.toISOString().slice(0, 10);
  const endISO = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  )
    .toISOString()
    .slice(0, 10);

  const [{ data: txs }, displayCurrency, rates] = await Promise.all([
    supabase
      .from("transactions")
      .select("category_id, amount_account, currency, date, account:accounts(currency)")
      .gte("date", startISO)
      .lte("date", endISO)
      .eq("is_historical_ir_only", false)
      .not("category_id", "is", null),
    getDisplayCurrency(),
    getRateMap(),
  ]);

  // Pré-popula buckets cronologicamente
  const monthKeys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    monthKeys.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
    );
  }

  type Bucket = { total: number; byMonth: number[]; txCount: number };
  const buckets = new Map<string, Bucket>();

  for (const t of (txs ?? []) as Array<{
    category_id: string;
    amount_account: number;
    currency: Currency;
    date: string;
    account: { currency: Currency } | { currency: Currency }[] | null;
  }>) {
    const acc = Array.isArray(t.account) ? t.account[0] : t.account;
    const c = (acc?.currency ?? t.currency ?? "BRL") as Currency;
    const amt = convertOrSame(Number(t.amount_account ?? 0), c, displayCurrency, rates);
    const monthKey = t.date.slice(0, 7);
    const monthIdx = monthKeys.indexOf(monthKey);
    if (monthIdx < 0) continue;
    let b = buckets.get(t.category_id);
    if (!b) {
      b = { total: 0, byMonth: new Array(months).fill(0), txCount: 0 };
      buckets.set(t.category_id, b);
    }
    b.total += amt;
    b.byMonth[monthIdx] += amt;
    b.txCount += 1;
  }

  const out = new Map<string, CategoryStats>();
  for (const [id, b] of buckets) {
    out.set(id, {
      total: Math.round(b.total * 100) / 100,
      monthlyAverage: Math.round((b.total / months) * 100) / 100,
      byMonth: b.byMonth.map((v) => Math.round(v * 100) / 100),
      txCount: b.txCount,
    });
  }
  return out;
}
