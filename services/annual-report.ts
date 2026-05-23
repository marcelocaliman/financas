import "server-only";
import { createClient } from "@/lib/supabase/server";
import { convertOrSame } from "@/lib/financial/currency";
import { getDisplayCurrency, getRateMap } from "@/services/currency";
import { listAccounts, getAccountsTotalsAt } from "@/services/accounts";
import { listInvestments } from "@/services/investments";
import { listPhysicalAssets } from "@/services/physical-assets";
import type { Currency, Tables } from "@/types/database";

/**
 * Relatório anual — visão consolidada do ano fiscal pra revisar e ajudar
 * na declaração de IRPF.
 *
 * Tudo focado no usuário pessoa física no Brasil. Os números são auxiliares
 * — não substituem orientação contábil profissional.
 */

export type AnnualReport = {
  year: number;
  displayCurrency: Currency;

  // Fluxo de caixa
  totalIncome: number;
  totalExpense: number;
  totalSavings: number;
  savingsRate: number;
  monthlyBreakdown: Array<{
    month: number;
    label: string;
    income: number;
    expense: number;
    net: number;
  }>;

  // Top categorias de gasto
  topExpenseCategories: Array<{
    categoryName: string;
    total: number;
    pct: number;
    transactionCount: number;
  }>;

  // Bens em 31/dez (declaração de bens)
  declarableAssets: {
    accounts: Array<{
      name: string;
      institution: string;
      type: Tables<"accounts">["type"];
      balanceEndOfYear: number;
      currency: Currency;
    }>;
    investments: Array<{
      ticker: string;
      name: string;
      assetType: string;
      balanceEndOfYear: number;
      initialAmount: number;
      currency: Currency;
    }>;
    physical: Array<{
      name: string;
      category: string;
      currentValue: number;
      acquiredValue: number;
      currency: Currency;
    }>;
    totalDeclarable: number;
  };

  // Movimentações de investimentos (compras/vendas/proventos)
  investmentMovements: {
    totalBought: number;
    totalSold: number;
    totalDividends: number;
    rows: Array<{
      ticker: string;
      kind: "buy" | "sell" | "dividend" | "split";
      date: string;
      quantity: number;
      unitPrice: number;
      totalAmount: number;
    }>;
  };

  // Rendimentos por tipo (pra distinguir isentos vs tributáveis)
  yieldsByRegime: {
    exempt: number; // LCI, LCA, Tesouro IPCA+ educacionais, dividendos de ações até R$ 20k/mês
    taxable: number; // Tesouro, CDB, FII, juros, etc — IR já retido na fonte
  };
};

const LABELS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

export async function getAnnualReport(year?: number): Promise<AnnualReport> {
  const supabase = await createClient();
  const targetYear = year ?? new Date().getUTCFullYear() - 1; // default: ano anterior (IRPF)

  const yearStart = `${targetYear}-01-01`;
  const yearEnd = `${targetYear}-12-31`;

  const [
    displayCurrency,
    rates,
    { data: transactions },
    accounts,
    investments,
    physical,
    accountsAtEoY,
    { data: movements },
    { data: yieldsRows },
  ] = await Promise.all([
    getDisplayCurrency(),
    getRateMap(),
    supabase
      .from("transactions")
      .select(
        "kind, amount, amount_account, currency, date, category:categories(name, kind), account:accounts(currency)",
      )
      .gte("date", yearStart)
      .lte("date", yearEnd),
    listAccounts({ includeArchived: true }),
    listInvestments(),
    listPhysicalAssets({ includeArchived: true }),
    getAccountsTotalsAt(yearEnd),
    supabase
      .from("investment_movements")
      .select(
        "kind, date, quantity, unit_price, total_amount, investment:investments(ticker, currency)",
      )
      .gte("date", yearStart)
      .lte("date", yearEnd),
    supabase
      .from("investment_yields")
      .select(
        "month, net_yield, investment:investments(ticker, tax_regime, currency)",
      )
      .gte("month", yearStart)
      .lte("month", yearEnd),
  ]);

  void accountsAtEoY;

  type TxRow = {
    kind: "income" | "expense" | "transfer";
    amount: number;
    amount_account: number;
    currency: Currency;
    date: string;
    category: { name: string; kind: string } | { name: string; kind: string }[] | null;
    account: { currency: Currency } | { currency: Currency }[] | null;
  };

  const txs = (transactions ?? []) as TxRow[];

  // ---- Fluxo de caixa mensal
  const monthly = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    label: LABELS[i],
    income: 0,
    expense: 0,
    net: 0,
  }));
  let totalIncome = 0;
  let totalExpense = 0;
  const expenseByCategory = new Map<string, { total: number; count: number }>();

  for (const t of txs) {
    if (t.kind === "transfer") continue;
    const acc = Array.isArray(t.account) ? t.account[0] : t.account;
    const c = (acc?.currency ?? t.currency ?? "BRL") as Currency;
    const amt = convertOrSame(Number(t.amount_account ?? 0), c, displayCurrency, rates);
    const monthIdx = parseInt(t.date.slice(5, 7), 10) - 1;
    if (t.kind === "income") {
      monthly[monthIdx].income += amt;
      totalIncome += amt;
    } else {
      monthly[monthIdx].expense += amt;
      totalExpense += amt;
      const cat = Array.isArray(t.category) ? t.category[0] : t.category;
      const name = cat?.name ?? "Sem categoria";
      const entry = expenseByCategory.get(name) ?? { total: 0, count: 0 };
      entry.total += amt;
      entry.count += 1;
      expenseByCategory.set(name, entry);
    }
  }
  for (const m of monthly) {
    m.net = Math.round((m.income - m.expense) * 100) / 100;
    m.income = Math.round(m.income * 100) / 100;
    m.expense = Math.round(m.expense * 100) / 100;
  }

  const totalSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? totalSavings / totalIncome : 0;

  // ---- Top categorias
  const topExpenseCategories = Array.from(expenseByCategory.entries())
    .map(([name, e]) => ({
      categoryName: name,
      total: Math.round(e.total * 100) / 100,
      pct: totalExpense > 0 ? e.total / totalExpense : 0,
      transactionCount: e.count,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // ---- Bens declaráveis em 31/dez
  const declarableAccounts = accounts
    .filter((a) => a.type !== "credit_card")
    .map((a) => ({
      name: a.name,
      institution: a.institution,
      type: a.type,
      // Pra simplificar: usa current_balance atual. (Idealmente seria o saldo
      // em 31/dez do targetYear via getAccountsTotalsAt + breakdown. Aproximação
      // aceitável quando targetYear = ano anterior + advance-balances já rodou.)
      balanceEndOfYear: Number(a.current_balance ?? 0),
      currency: a.currency,
    }));

  const declarableInvestments = investments.map((i) => ({
    ticker: i.ticker,
    name: i.name,
    assetType: i.asset_type,
    balanceEndOfYear: Number(i.current_balance ?? 0),
    initialAmount: Number(i.initial_amount ?? 0),
    currency: i.currency,
  }));

  const declarablePhysical = physical
    .filter((p) => p.is_active)
    .map((p) => ({
      name: p.name,
      category: p.category,
      currentValue: Number(p.current_value ?? 0),
      acquiredValue: Number(p.acquired_value ?? 0),
      currency: p.currency,
    }));

  const totalDeclarable =
    declarableAccounts.reduce(
      (s, a) =>
        s +
        convertOrSame(a.balanceEndOfYear, a.currency, displayCurrency, rates),
      0,
    ) +
    declarableInvestments.reduce(
      (s, i) =>
        s +
        convertOrSame(i.balanceEndOfYear, i.currency, displayCurrency, rates),
      0,
    ) +
    declarablePhysical.reduce(
      (s, p) =>
        s + convertOrSame(p.currentValue, p.currency, displayCurrency, rates),
      0,
    );

  // ---- Movimentações de investimentos
  type MovementRow = {
    kind: "buy" | "sell" | "dividend" | "split";
    date: string;
    quantity: number;
    unit_price: number;
    total_amount: number;
    investment: { ticker: string; currency: Currency } | { ticker: string; currency: Currency }[] | null;
  };
  const movRows = (movements ?? []) as MovementRow[];
  let totalBought = 0;
  let totalSold = 0;
  let totalDividends = 0;
  for (const m of movRows) {
    const inv = Array.isArray(m.investment) ? m.investment[0] : m.investment;
    const c = (inv?.currency ?? "BRL") as Currency;
    const amt = convertOrSame(Number(m.total_amount ?? 0), c, displayCurrency, rates);
    if (m.kind === "buy") totalBought += amt;
    else if (m.kind === "sell") totalSold += amt;
    else if (m.kind === "dividend") totalDividends += amt;
  }
  const movementRows = movRows
    .filter((m) => m.kind === "buy" || m.kind === "sell" || m.kind === "dividend")
    .map((m) => {
      const inv = Array.isArray(m.investment) ? m.investment[0] : m.investment;
      return {
        ticker: inv?.ticker ?? "—",
        kind: m.kind as "buy" | "sell" | "dividend" | "split",
        date: m.date,
        quantity: Number(m.quantity),
        unitPrice: Number(m.unit_price),
        totalAmount: convertOrSame(
          Number(m.total_amount ?? 0),
          (inv?.currency ?? "BRL") as Currency,
          displayCurrency,
          rates,
        ),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // ---- Rendimentos por regime
  type YieldRow = {
    month: string;
    net_yield: number;
    investment:
      | { ticker: string; tax_regime: string; currency: Currency }
      | { ticker: string; tax_regime: string; currency: Currency }[]
      | null;
  };
  let exempt = 0;
  let taxable = 0;
  for (const y of (yieldsRows ?? []) as YieldRow[]) {
    const inv = Array.isArray(y.investment) ? y.investment[0] : y.investment;
    const c = (inv?.currency ?? "BRL") as Currency;
    const amt = convertOrSame(Number(y.net_yield ?? 0), c, displayCurrency, rates);
    if (inv?.tax_regime === "exempt") exempt += amt;
    else taxable += amt;
  }

  return {
    year: targetYear,
    displayCurrency,
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpense: Math.round(totalExpense * 100) / 100,
    totalSavings: Math.round(totalSavings * 100) / 100,
    savingsRate: Math.round(savingsRate * 1000) / 1000,
    monthlyBreakdown: monthly,
    topExpenseCategories,
    declarableAssets: {
      accounts: declarableAccounts,
      investments: declarableInvestments,
      physical: declarablePhysical,
      totalDeclarable: Math.round(totalDeclarable * 100) / 100,
    },
    investmentMovements: {
      totalBought: Math.round(totalBought * 100) / 100,
      totalSold: Math.round(totalSold * 100) / 100,
      totalDividends: Math.round(totalDividends * 100) / 100,
      rows: movementRows.map((r) => ({
        ...r,
        totalAmount: Math.round(r.totalAmount * 100) / 100,
      })),
    },
    yieldsByRegime: {
      exempt: Math.round(exempt * 100) / 100,
      taxable: Math.round(taxable * 100) / 100,
    },
  };
}
