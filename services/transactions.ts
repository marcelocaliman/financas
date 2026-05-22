import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables, TransactionKind } from "@/types/database";

export type Transaction = Tables<"transactions"> & {
  account?: Pick<Tables<"accounts">, "id" | "name" | "institution" | "type"> | null;
  category?: Pick<Tables<"categories">, "id" | "name" | "kind" | "color" | "icon"> | null;
};

export type TransactionFilters = {
  month?: string; // YYYY-MM
  accountId?: string;
  categoryId?: string;
  kind?: TransactionKind | "all";
  search?: string;
  page?: number;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 40;

export function monthRange(monthStr?: string): { from: string; to: string; label: string } {
  // monthStr formato "YYYY-MM"; default = mês corrente em SP
  const now = new Date();
  const [yStr, mStr] = monthStr?.split("-") ?? [
    now.toLocaleString("pt-BR", { year: "numeric", timeZone: "America/Sao_Paulo" }),
    String(now.getMonth() + 1).padStart(2, "0"),
  ];
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  // último dia do mês
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return { from, to, label };
}

export async function listTransactions(filters: TransactionFilters = {}): Promise<{
  rows: Transaction[];
  total: number;
}> {
  const supabase = await createClient();
  const { from, to } = monthRange(filters.month);
  const page = filters.page ?? 0;
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;

  let q = supabase
    .from("transactions")
    .select(
      "*, account:accounts(id,name,institution,type), category:categories(id,name,kind,color,icon)",
      { count: "exact" },
    )
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.accountId) q = q.eq("account_id", filters.accountId);
  if (filters.categoryId) q = q.eq("category_id", filters.categoryId);
  if (filters.kind && filters.kind !== "all") q = q.eq("kind", filters.kind);
  if (filters.search) q = q.ilike("description", `%${filters.search}%`);

  q = q.range(page * pageSize, (page + 1) * pageSize - 1);

  const { data, error, count } = await q;
  if (error) throw error;

  return {
    rows: (data ?? []) as Transaction[],
    total: count ?? 0,
  };
}

export type MonthlySummary = {
  income: number;
  expense: number;
  net: number;
  fromDate: string;
  toDate: string;
  label: string;
  transactionCount: number;
};

export async function getMonthlySummary(monthStr?: string): Promise<MonthlySummary> {
  const supabase = await createClient();
  const { from, to, label } = monthRange(monthStr);

  // Receitas e despesas excluem transferências (que apenas movem dinheiro entre contas)
  const { data, error } = await supabase
    .from("transactions")
    .select("kind, amount")
    .gte("date", from)
    .lte("date", to)
    .in("kind", ["income", "expense"]);
  if (error) throw error;

  let income = 0;
  let expense = 0;
  for (const t of data ?? []) {
    const amt = Number(t.amount);
    if (t.kind === "income") income += amt;
    else if (t.kind === "expense") expense += amt;
  }

  // Conta total inclui transferências (todos os movimentos)
  const { count } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .gte("date", from)
    .lte("date", to);

  return {
    income: Math.round(income * 100) / 100,
    expense: Math.round(expense * 100) / 100,
    net: Math.round((income - expense) * 100) / 100,
    fromDate: from,
    toDate: to,
    label,
    transactionCount: count ?? 0,
  };
}

export type CategoryBreakdownRow = {
  category_id: string | null;
  category_name: string;
  category_color: string | null;
  category_icon: string | null;
  total: number;
  count: number;
  pct: number;
};

export async function getCategoryBreakdown(
  monthStr?: string,
  kind: TransactionKind = "expense",
): Promise<CategoryBreakdownRow[]> {
  const supabase = await createClient();
  const { from, to } = monthRange(monthStr);

  const { data, error } = await supabase
    .from("transactions")
    .select("amount, category:categories(id,name,color,icon)")
    .gte("date", from)
    .lte("date", to)
    .eq("kind", kind);
  if (error) throw error;

  const byCat = new Map<string, CategoryBreakdownRow>();
  let grandTotal = 0;
  for (const t of data ?? []) {
    const cat = t.category as { id: string; name: string; color: string | null; icon: string | null } | null;
    const key = cat?.id ?? "uncategorized";
    const name = cat?.name ?? "Sem categoria";
    const amt = Number(t.amount);
    grandTotal += amt;
    if (!byCat.has(key)) {
      byCat.set(key, {
        category_id: cat?.id ?? null,
        category_name: name,
        category_color: cat?.color ?? null,
        category_icon: cat?.icon ?? null,
        total: 0,
        count: 0,
        pct: 0,
      });
    }
    const row = byCat.get(key)!;
    row.total += amt;
    row.count += 1;
  }

  const out = [...byCat.values()].sort((a, b) => b.total - a.total);
  for (const r of out) r.pct = grandTotal > 0 ? r.total / grandTotal : 0;
  return out;
}
