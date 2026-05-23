import "server-only";
import { createClient } from "@/lib/supabase/server";
import { convertOrSame } from "@/lib/financial/currency";
import { getDisplayCurrency, getRateMap } from "@/services/currency";
import { listCategories } from "@/services/categories";
import { monthRange } from "@/services/transactions";
import type { Currency, Tables } from "@/types/database";

/**
 * Orçamento por categoria — comparativo entre o que foi orçado e o que de
 * fato foi gasto no mês.
 *
 * Por que tabela separada (não coluna em categories):
 *   Permite histórico — usuário pode mudar o budget e ver "Mercado era R$ 1500
 *   em jan, virou R$ 1700 em fev". Pra ler "qual o budget atual de C",
 *   pegamos a linha com maior start_month ≤ mês alvo.
 */

export type CategoryBudget = Tables<"category_budgets">;

export type BudgetVsActual = {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  /** Budget em moeda nativa do orçamento */
  budgetAmount: number;
  budgetCurrency: Currency;
  alertThreshold: number;
  /** Gasto real no mês, convertido pra moeda do orçamento */
  actualSpent: number;
  /** Razão actual / budget */
  ratio: number;
  /** Status: ok (<thresh), warning (>=thresh, <1), over (≥1), no_budget (sem budget) */
  status: "ok" | "warning" | "over" | "no_budget";
  /** Variação vs mês anterior */
  vsPrevMonthRatio: number | null;
};

function monthKeyForDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).format(d);
}

function startOfMonth(monthYYYYMM: string): string {
  return `${monthYYYYMM}-01`;
}

/**
 * Resolve o budget vigente pra cada categoria no mês alvo.
 * Pega a linha com maior start_month ≤ mês alvo, por categoria.
 */
export async function getActiveBudgetsForMonth(
  monthYYYYMM?: string,
): Promise<Map<string, CategoryBudget>> {
  const supabase = await createClient();
  const target = monthYYYYMM ?? monthKeyForDate(new Date());
  const monthStart = startOfMonth(target);

  const { data } = await supabase
    .from("category_budgets")
    .select("*")
    .lte("start_month", monthStart)
    .order("start_month", { ascending: false });

  // Para cada category_id, a primeira encontrada (mais recente) vence
  const out = new Map<string, CategoryBudget>();
  for (const b of (data ?? []) as CategoryBudget[]) {
    if (!out.has(b.category_id)) out.set(b.category_id, b);
  }
  return out;
}

/**
 * Comparativo orçado vs gasto pra todas as categorias de despesa que
 * têm budget ativo no mês alvo. Inclui mês anterior pra delta.
 */
export async function getBudgetVsActual(monthYYYYMM?: string): Promise<BudgetVsActual[]> {
  const supabase = await createClient();
  const targetMonth = monthYYYYMM ?? monthKeyForDate(new Date());
  const { from, to } = monthRange(targetMonth);

  // Mês anterior pra comparação
  const [y, m] = targetMonth.split("-").map(Number);
  const prevDate = new Date(Date.UTC(y, m - 2, 1));
  const prevMonth = monthKeyForDate(prevDate);
  const prevRange = monthRange(prevMonth);

  const [
    budgets,
    categories,
    { data: currentTxs },
    { data: prevTxs },
    displayCurrency,
    rates,
  ] = await Promise.all([
    getActiveBudgetsForMonth(targetMonth),
    listCategories({ includeArchived: false }),
    supabase
      .from("transactions")
      .select("category_id, amount_account, currency, account:accounts(currency)")
      .eq("kind", "expense")
      .gte("date", from)
      .lte("date", to)
      .not("category_id", "is", null),
    supabase
      .from("transactions")
      .select("category_id, amount_account, currency, account:accounts(currency)")
      .eq("kind", "expense")
      .gte("date", prevRange.from)
      .lte("date", prevRange.to)
      .not("category_id", "is", null),
    getDisplayCurrency(),
    getRateMap(),
  ]);

  void displayCurrency;

  type TxRow = {
    category_id: string;
    amount_account: number;
    currency: Currency;
    account: { currency: Currency } | { currency: Currency }[] | null;
  };

  const aggregateByCategory = (rows: TxRow[], targetCurrency: Currency): number => {
    let total = 0;
    for (const t of rows) {
      const acc = Array.isArray(t.account) ? t.account[0] : t.account;
      const c = (acc?.currency ?? t.currency ?? "BRL") as Currency;
      total += convertOrSame(Number(t.amount_account ?? 0), c, targetCurrency, rates);
    }
    return total;
  };

  // Agrupa por categoria
  const currentByCat = new Map<string, TxRow[]>();
  for (const t of (currentTxs ?? []) as TxRow[]) {
    if (!t.category_id) continue;
    const arr = currentByCat.get(t.category_id) ?? [];
    arr.push(t);
    currentByCat.set(t.category_id, arr);
  }
  const prevByCat = new Map<string, TxRow[]>();
  for (const t of (prevTxs ?? []) as TxRow[]) {
    if (!t.category_id) continue;
    const arr = prevByCat.get(t.category_id) ?? [];
    arr.push(t);
    prevByCat.set(t.category_id, arr);
  }

  const out: BudgetVsActual[] = [];

  // Para cada categoria com budget OU com gasto, gera uma linha
  const catIds = new Set([
    ...budgets.keys(),
    ...currentByCat.keys(),
  ]);

  for (const catId of catIds) {
    const cat = categories.find((c) => c.id === catId);
    if (!cat || cat.kind !== "expense") continue;

    const budget = budgets.get(catId);
    const budgetCurrency = budget?.currency ?? "BRL";
    const actualSpent = aggregateByCategory(currentByCat.get(catId) ?? [], budgetCurrency);
    const prevSpent = aggregateByCategory(prevByCat.get(catId) ?? [], budgetCurrency);

    const budgetAmount = budget ? Number(budget.amount) : 0;
    const alertThreshold = budget ? Number(budget.alert_threshold) : 0.8;
    const ratio = budgetAmount > 0 ? actualSpent / budgetAmount : 0;

    let status: BudgetVsActual["status"];
    if (!budget) status = "no_budget";
    else if (ratio >= 1) status = "over";
    else if (ratio >= alertThreshold) status = "warning";
    else status = "ok";

    const vsPrev = prevSpent > 0 ? actualSpent / prevSpent - 1 : null;

    out.push({
      categoryId: catId,
      categoryName: cat.name,
      categoryIcon: cat.icon,
      categoryColor: cat.color,
      budgetAmount,
      budgetCurrency,
      alertThreshold,
      actualSpent: Math.round(actualSpent * 100) / 100,
      ratio: Math.round(ratio * 1000) / 1000,
      status,
      vsPrevMonthRatio: vsPrev != null ? Math.round(vsPrev * 1000) / 1000 : null,
    });
  }

  // Ordena: over primeiro (mais urgente), depois warning, depois ok, depois sem budget
  const order = { over: 0, warning: 1, ok: 2, no_budget: 3 };
  out.sort((a, b) => {
    const so = order[a.status] - order[b.status];
    if (so !== 0) return so;
    return b.ratio - a.ratio;
  });

  return out;
}

/**
 * Conta quantas categorias estão acima do limite (status='over') no mês corrente.
 * Usado pra badge na sidebar/dashboard.
 */
export async function countOverBudget(): Promise<number> {
  const rows = await getBudgetVsActual();
  return rows.filter((r) => r.status === "over").length;
}
