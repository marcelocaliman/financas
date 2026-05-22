/**
 * services/accounts — leituras (Server-only).
 * Mutations vivem em services/accounts.actions.ts ("use server").
 */

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { convertOrSame } from "@/lib/financial/currency";
import { getDisplayCurrency, getRateMap } from "@/services/currency";
import type { AccountType, Currency, Tables } from "@/types/database";

export type Account = Tables<"accounts">;

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  credit_card: "Cartão de crédito",
  investment: "Investimento",
  cash: "Dinheiro",
};

export async function listAccounts(opts?: { includeArchived?: boolean }): Promise<Account[]> {
  const supabase = await createClient();
  let q = supabase
    .from("accounts")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (!opts?.includeArchived) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Account[];
}

export async function getAccount(id: string): Promise<Account | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("accounts").select("*").eq("id", id).maybeSingle();
  return (data as Account) ?? null;
}

export async function getAccountsTotals(): Promise<{
  byType: Record<AccountType, number>;
  total: number;
  liquidExcludingInvestmentCash: number;
  displayCurrency: Currency;
}> {
  const [accounts, displayCurrency, rates] = await Promise.all([
    listAccounts(),
    getDisplayCurrency(),
    getRateMap(),
  ]);
  const byType = {
    checking: 0,
    savings: 0,
    credit_card: 0,
    investment: 0,
    cash: 0,
  } as Record<AccountType, number>;
  for (const a of accounts) {
    const native = Number(a.current_balance ?? 0);
    const converted = convertOrSame(native, a.currency, displayCurrency, rates);
    byType[a.type] += converted;
  }
  const total =
    byType.checking + byType.savings + byType.investment + byType.cash + byType.credit_card;
  // Para evitar dupla contagem ao somar investments separados, o caixa da
  // corretora (type='investment') NÃO entra no total líquido. Os ativos
  // somam por fora via getPortfolioStats.
  const liquidExcludingInvestmentCash =
    byType.checking + byType.savings + byType.cash + byType.credit_card;
  return { byType, total, liquidExcludingInvestmentCash, displayCurrency };
}
