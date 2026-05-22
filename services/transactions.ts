import "server-only";
import { createClient } from "@/lib/supabase/server";
import { convertOrSame } from "@/lib/financial/currency";
import { getDisplayCurrency, getRateMap } from "@/services/currency";
import type { Currency, Tables, TransactionKind } from "@/types/database";

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
  displayCurrency: Currency;
};

export async function getMonthlySummary(monthStr?: string): Promise<MonthlySummary> {
  const supabase = await createClient();
  const { from, to, label } = monthRange(monthStr);

  // Receitas e despesas excluem transferências (que apenas movem dinheiro entre contas)
  const [{ data, error }, displayCurrency, rates] = await Promise.all([
    supabase
      .from("transactions")
      .select("kind, amount_account, currency, account:accounts(currency)")
      .gte("date", from)
      .lte("date", to)
      .in("kind", ["income", "expense"]),
    getDisplayCurrency(),
    getRateMap(),
  ]);
  if (error) throw error;

  let income = 0;
  let expense = 0;
  for (const t of data ?? []) {
    const acc = Array.isArray(t.account) ? t.account[0] : t.account;
    const c = (acc?.currency ?? t.currency ?? "BRL") as Currency;
    const amt = convertOrSame(Number(t.amount_account ?? 0), c, displayCurrency, rates);
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
    displayCurrency,
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

export type MonthlyHistoryRow = {
  month: string; // YYYY-MM
  label: string; // "jan", "fev", ...
  income: number;
  expense: number;
  net: number;
  /** True quando os números são previstos (mês futuro com forecast aplicado) */
  isForecast?: boolean;
};

/**
 * Histórico dos últimos N meses (incluindo o mês de referência).
 * Apenas income/expense (transferências não inflam).
 *
 * `endMonth` no formato "YYYY-MM" — se omitido, usa o mês corrente.
 * Útil pra ver "últimos 6 meses terminando em março/2026".
 */
export async function getMonthlyHistory(
  months = 6,
  endMonth?: string,
  opts?: { includeForecast?: boolean },
): Promise<MonthlyHistoryRow[]> {
  const supabase = await createClient();

  // Calcula o mês de referência (default = mês corrente em SP)
  let y: number;
  let m: number;
  if (endMonth) {
    const parts = endMonth.split("-").map(Number);
    y = parts[0];
    m = parts[1];
  } else {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
    });
    const [yStr, mStr] = fmt.format(new Date()).split("-");
    y = parseInt(yStr, 10);
    m = parseInt(mStr, 10);
  }
  const fromYear = m - (months - 1) <= 0 ? y - Math.ceil((months - 1 - m + 1) / 12) : y;
  // Calcula primeiro dia: aritmética com Date
  const start = new Date(Date.UTC(y, m - 1 - (months - 1), 1));
  const startISO = start.toISOString().slice(0, 10);
  const endISO = `${y}-${String(m).padStart(2, "0")}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;

  const [{ data, error }, displayCurrency, rates] = await Promise.all([
    supabase
      .from("transactions")
      .select("kind, amount_account, currency, date, account:accounts(currency)")
      .gte("date", startISO)
      .lte("date", endISO)
      .in("kind", ["income", "expense"]),
    getDisplayCurrency(),
    getRateMap(),
  ]);
  if (error) throw error;

  const buckets = new Map<string, { income: number; expense: number }>();

  // Pré-popula meses na ordem cronológica
  const labels = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const out: MonthlyHistoryRow[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, { income: 0, expense: 0 });
    out.push({
      month: key,
      label: labels[d.getUTCMonth()],
      income: 0,
      expense: 0,
      net: 0,
    });
  }

  for (const t of data ?? []) {
    const key = (t.date as string).slice(0, 7);
    const b = buckets.get(key);
    if (!b) continue;
    const acc = Array.isArray(t.account) ? t.account[0] : t.account;
    const c = (acc?.currency ?? t.currency ?? "BRL") as Currency;
    const amt = convertOrSame(Number(t.amount_account ?? 0), c, displayCurrency, rates);
    if (t.kind === "income") b.income += amt;
    else b.expense += amt;
  }

  for (const row of out) {
    const b = buckets.get(row.month)!;
    row.income = Math.round(b.income * 100) / 100;
    row.expense = Math.round(b.expense * 100) / 100;
    row.net = Math.round((b.income - b.expense) * 100) / 100;
  }
  // Silenciar warning de "fromYear unused"
  void fromYear;

  // Opcional: pra meses no FUTURO, soma a previsão das recorrências.
  // Marca como isForecast=true quando o mês não tinha transações reais
  // (assim o chart pode renderizar diferente).
  if (opts?.includeForecast) {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
    });
    const todayMonth = fmt.format(new Date()); // YYYY-MM
    const futureRows = out.filter((r) => r.month > todayMonth);
    if (futureRows.length > 0) {
      // Lazy import pra evitar ciclo (transactions ↔ recurrences)
      const { getRecurrencesForecast } = await import("@/services/recurrences");
      const forecasts = await Promise.all(
        futureRows.map((r) => getRecurrencesForecast(r.month)),
      );
      forecasts.forEach((fc, i) => {
        const row = futureRows[i];
        const realIncome = row.income;
        const realExpense = row.expense;
        row.income = Math.round((realIncome + fc.income) * 100) / 100;
        row.expense = Math.round((realExpense + fc.expense) * 100) / 100;
        row.net = Math.round((row.income - row.expense) * 100) / 100;
        // Marca como previsão quando o real estava vazio E o forecast trouxe algo
        if (realIncome === 0 && realExpense === 0 && fc.count > 0) {
          row.isForecast = true;
        }
      });
    }
  }

  return out;
}

export type ExpenseAnomaly = {
  categoryId: string | null;
  categoryName: string;
  currentTotal: number;
  averagePrior: number;
  pctAbove: number;
  severity: "medium" | "high";
};

/**
 * Detecta gastos atípicos no mês corrente.
 * Critério: gasto da categoria > 1.5× média dos 3 meses anteriores
 *           AND gasto absoluto > R$ 100.
 */
export async function detectExpenseAnomalies(): Promise<ExpenseAnomaly[]> {
  const supabase = await createClient();

  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [yStr, mStr] = fmt.format(now).split("-");
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);

  // Mês corrente: [startCurrent .. endCurrent]
  const startCurrent = `${y}-${String(m).padStart(2, "0")}-01`;
  const endCurrent = `${y}-${String(m).padStart(2, "0")}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
  // 3 meses anteriores
  const startPrior = new Date(Date.UTC(y, m - 4, 1)).toISOString().slice(0, 10);
  const endPrior = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);

  const [{ data: current, error: e1 }, { data: prior, error: e2 }, displayCurrency, rates] =
    await Promise.all([
      supabase
        .from("transactions")
        .select("amount_account, currency, category_id, category:categories(id,name), account:accounts(currency)")
        .gte("date", startCurrent)
        .lte("date", endCurrent)
        .eq("kind", "expense"),
      supabase
        .from("transactions")
        .select("amount_account, currency, category_id, date, account:accounts(currency)")
        .gte("date", startPrior)
        .lte("date", endPrior)
        .eq("kind", "expense"),
      getDisplayCurrency(),
      getRateMap(),
    ]);
  if (e1) throw e1;
  if (e2) throw e2;

  type Row = {
    amount_account: number;
    currency?: Currency | null;
    category_id: string | null;
    category?: { id: string; name: string } | { id: string; name: string }[] | null;
    account?: { currency: Currency } | { currency: Currency }[] | null;
  };
  const cur = (current ?? []) as Row[];
  const pri = (prior ?? []) as Row[];

  const convertRow = (t: Row): number => {
    const acc = Array.isArray(t.account) ? t.account[0] : t.account;
    const c = (acc?.currency ?? t.currency ?? "BRL") as Currency;
    return convertOrSame(Number(t.amount_account ?? 0), c, displayCurrency, rates);
  };

  const currentByCat = new Map<string, { name: string; total: number }>();
  for (const t of cur) {
    const key = t.category_id ?? "uncategorized";
    const catObj = Array.isArray(t.category) ? t.category[0] : t.category;
    const name = catObj?.name ?? "Sem categoria";
    const e = currentByCat.get(key) ?? { name, total: 0 };
    e.total += convertRow(t);
    e.name = name;
    currentByCat.set(key, e);
  }

  // Para a média dos 3 meses anteriores, somar por categoria e dividir por 3.
  const priorTotalByCat = new Map<string, number>();
  for (const t of pri) {
    const key = t.category_id ?? "uncategorized";
    priorTotalByCat.set(key, (priorTotalByCat.get(key) ?? 0) + convertRow(t));
  }

  const anomalies: ExpenseAnomaly[] = [];
  for (const [key, cur] of currentByCat) {
    const avg = (priorTotalByCat.get(key) ?? 0) / 3;
    if (avg === 0 && cur.total < 200) continue; // categoria nova com gasto baixo: ignora
    if (cur.total < 100) continue;
    if (avg > 0 && cur.total <= avg * 1.5) continue;

    const pct = avg > 0 ? cur.total / avg - 1 : 1;
    anomalies.push({
      categoryId: key === "uncategorized" ? null : key,
      categoryName: cur.name,
      currentTotal: Math.round(cur.total * 100) / 100,
      averagePrior: Math.round(avg * 100) / 100,
      pctAbove: pct,
      severity: pct > 1 ? "high" : "medium",
    });
  }

  return anomalies.sort((a, b) => b.pctAbove - a.pctAbove);
}

export async function getCategoryBreakdown(
  monthStr?: string,
  kind: TransactionKind = "expense",
): Promise<CategoryBreakdownRow[]> {
  const supabase = await createClient();
  const { from, to } = monthRange(monthStr);

  const [{ data, error }, displayCurrency, rates] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "amount_account, currency, category:categories(id,name,color,icon), account:accounts(currency)",
      )
      .gte("date", from)
      .lte("date", to)
      .eq("kind", kind),
    getDisplayCurrency(),
    getRateMap(),
  ]);
  if (error) throw error;

  const byCat = new Map<string, CategoryBreakdownRow>();
  let grandTotal = 0;
  for (const t of data ?? []) {
    const catRaw = t.category as
      | { id: string; name: string; color: string | null; icon: string | null }
      | { id: string; name: string; color: string | null; icon: string | null }[]
      | null;
    const cat = Array.isArray(catRaw) ? catRaw[0] : catRaw;
    const accRaw = t.account as { currency: Currency } | { currency: Currency }[] | null;
    const acc = Array.isArray(accRaw) ? accRaw[0] : accRaw;
    const c = (acc?.currency ?? t.currency ?? "BRL") as Currency;
    const key = cat?.id ?? "uncategorized";
    const name = cat?.name ?? "Sem categoria";
    const amt = convertOrSame(Number(t.amount_account ?? 0), c, displayCurrency, rates);
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

/**
 * Biggest movers — categorias que mais subiram/cairam entre dois meses.
 * Útil pra página /analise: "onde o dinheiro mudou de comportamento".
 *
 * `monthStr` = mês atual (default: corrente). Compara com o mês ANTERIOR.
 * Retorna lista ordenada por delta absoluto (descendente).
 */
export type CategoryMover = {
  category_id: string | null;
  category_name: string;
  currentTotal: number;
  previousTotal: number;
  delta: number; // current - previous
  pct: number | null; // null se previous=0
};

export async function getCategoryMovers(
  monthStr?: string,
  kind: TransactionKind = "expense",
): Promise<CategoryMover[]> {
  // Mês atual
  const current = await getCategoryBreakdown(monthStr, kind);

  // Mês anterior — calcula a partir de monthStr ou now
  let y: number;
  let m: number;
  if (monthStr) {
    const parts = monthStr.split("-").map(Number);
    y = parts[0];
    m = parts[1];
  } else {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
    });
    const [yStr, mStr] = fmt.format(new Date()).split("-");
    y = parseInt(yStr, 10);
    m = parseInt(mStr, 10);
  }
  const prev = new Date(Date.UTC(y, m - 2, 1));
  const prevMonthStr = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
  const previous = await getCategoryBreakdown(prevMonthStr, kind);

  const prevMap = new Map(previous.map((r) => [r.category_id ?? "uncat", r.total]));
  const curMap = new Map(current.map((r) => [r.category_id ?? "uncat", r]));
  const allKeys = new Set([
    ...current.map((r) => r.category_id ?? "uncat"),
    ...previous.map((r) => r.category_id ?? "uncat"),
  ]);

  const movers: CategoryMover[] = [];
  for (const key of allKeys) {
    const cur = curMap.get(key);
    const prevTotal = prevMap.get(key) ?? 0;
    const curTotal = cur?.total ?? 0;
    const delta = curTotal - prevTotal;
    if (Math.abs(delta) < 10) continue; // ignora ruído pequeno
    movers.push({
      category_id: cur?.category_id ?? null,
      category_name:
        cur?.category_name ??
        previous.find((p) => (p.category_id ?? "uncat") === key)?.category_name ??
        "Sem categoria",
      currentTotal: curTotal,
      previousTotal: prevTotal,
      delta,
      pct: prevTotal > 0 ? delta / prevTotal : null,
    });
  }
  movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return movers;
}
