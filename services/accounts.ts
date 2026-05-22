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

export type AccountsTotals = {
  byType: Record<AccountType, number>;
  total: number;
  liquidExcludingInvestmentCash: number;
  displayCurrency: Currency;
};

export async function getAccountsTotals(): Promise<AccountsTotals> {
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

/**
 * Saldo das contas em uma data passada/futura.
 *
 * Lógica: balance(at_date) = current_balance - sum(delta of transactions where date > at_date)
 *
 * Reusa a mesma regra do trigger SQL `transaction_balance_delta`:
 *   income: +amount_account; expense: -amount_account
 *   transfer in: +; transfer out: -
 *
 * Pra data no passado: subtrai os deltas das transações posteriores → saldo antes.
 * Pra data no futuro: idem — se houver transações futuras (recorrências
 * materializadas adiantadas), serão revertidas até a data alvo.
 *
 * NOTA: investimentos e bens físicos não são reconstruídos historicamente — o
 * Hero usa o valor atual deles + os saldos retroativos das contas, então o
 * "patrimônio em mês passado" é uma aproximação.
 */
export async function getAccountsTotalsAt(atDateISO: string): Promise<AccountsTotals> {
  const supabase = await createClient();
  const [accounts, { data: futureTxs }, displayCurrency, rates] = await Promise.all([
    listAccounts(),
    supabase
      .from("transactions")
      .select("account_id, kind, amount_account, transfer_direction, currency, account:accounts(currency)")
      .gt("date", atDateISO),
    getDisplayCurrency(),
    getRateMap(),
  ]);

  // Acumula delta posterior por conta (em moeda nativa da conta)
  const deltaByAccount = new Map<string, number>();
  for (const t of (futureTxs ?? []) as Array<{
    account_id: string;
    kind: "income" | "expense" | "transfer";
    amount_account: number;
    transfer_direction: "in" | "out" | null;
  }>) {
    const amt = Number(t.amount_account ?? 0);
    let delta = 0;
    if (t.kind === "income") delta = amt;
    else if (t.kind === "expense") delta = -amt;
    else if (t.kind === "transfer") {
      if (t.transfer_direction === "in") delta = amt;
      else if (t.transfer_direction === "out") delta = -amt;
    }
    deltaByAccount.set(t.account_id, (deltaByAccount.get(t.account_id) ?? 0) + delta);
  }

  const byType = {
    checking: 0,
    savings: 0,
    credit_card: 0,
    investment: 0,
    cash: 0,
  } as Record<AccountType, number>;
  for (const a of accounts) {
    const current = Number(a.current_balance ?? 0);
    const futureDelta = deltaByAccount.get(a.id) ?? 0;
    const historical = current - futureDelta;
    const converted = convertOrSame(historical, a.currency, displayCurrency, rates);
    byType[a.type] += converted;
  }
  const total =
    byType.checking + byType.savings + byType.investment + byType.cash + byType.credit_card;
  const liquidExcludingInvestmentCash =
    byType.checking + byType.savings + byType.cash + byType.credit_card;
  return { byType, total, liquidExcludingInvestmentCash, displayCurrency };
}
