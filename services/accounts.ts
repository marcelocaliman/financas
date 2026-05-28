/**
 * services/accounts — leituras (Server-only).
 * Mutations vivem em services/accounts.actions.ts ("use server").
 */

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { convertOrSame } from "@/lib/financial/currency";
import { getDisplayCurrency, getRateMap } from "@/services/currency";
import { getRecurrencesForecast } from "@/services/recurrences";
import { getCurrentValueMap } from "@/services/quotes";
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
  //
  // Cartão de crédito (saldo negativo = dívida) também NÃO entra no patrimônio
  // líquido. Modelo cash basis: a dívida só vira "perda de patrimônio" quando a
  // fatura é paga (cash sai da conta corrente). Até lá é um compromisso futuro,
  // visualizado em /contas mas não somado/subtraído do patrimônio.
  const liquidExcludingInvestmentCash =
    byType.checking + byType.savings + byType.cash;
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
      .eq("is_historical_ir_only", false)
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
  // Mesma regra de getAccountsTotals: credit_card fica fora do patrimônio líquido.
  const liquidExcludingInvestmentCash =
    byType.checking + byType.savings + byType.cash;
  return { byType, total, liquidExcludingInvestmentCash, displayCurrency };
}

/* ========================================================================== *
 * Saldos por conta num mês específico (passado ou futuro)
 *
 * Fórmula:
 *   balance(X) = current_balance
 *              - sum(deltas de transações REAIS com date > X)
 *              + sum(deltas de ocorrências PREVISTAS em (hoje, X])
 *
 * - Passado: real_deltas_após_X subtrai; forecast é vazio (range em (hoje, X<hoje]
 *   resulta em nada).
 * - Futuro: real_deltas_após_X tipicamente zero; forecast adiciona o esperado.
 * - Corrente: short-circuit, devolve current_balance direto.
 *
 * Conversão de moeda das previsões: rule.currency → account.currency.
 * ========================================================================== */

export type AccountWithBalance = Account & {
  displayBalance: number;
  /** "current" = saldo atual; "historical" = saldo retroativo (passado);
   *  "forecast" = saldo previsto (futuro com forecast aplicado). */
  balanceMode: "current" | "historical" | "forecast";
  /**
   * Para contas type='investment' (corretora): soma do current_balance de
   * todos os ativos linkados a essa conta (em moeda nativa da conta, via
   * convertOrSame). Permite mostrar Caixa + Ativos + Total no card.
   * Para outros tipos é 0.
   */
  assetsBalance: number;
};

/**
 * Calcula soma de ativos por account_id em moeda nativa de cada conta.
 *
 * Usa `getCurrentValueMap()` como fonte — o MESMO mapa que /investimentos
 * usa pra mostrar saldo de cada ativo. Garante que o "Em ativos" no card
 * de uma conta XP bata centavo com o "Saldo total" mostrado em
 * /investimentos. Sem cache duplicado: getLivePortfolio é cacheado por
 * request via React `cache()`, então chamar de qualquer lugar é grátis.
 */
async function getAssetsBalanceByAccount(
  accounts: Account[],
): Promise<Map<string, number>> {
  const investmentAccountIds = accounts
    .filter((a) => a.type === "investment")
    .map((a) => a.id);
  if (investmentAccountIds.length === 0) return new Map();

  const supabase = await createClient();
  // Precisamos apenas do account_id e currency de cada investment pra
  // saber a moeda nativa do ativo. O valor vem do getCurrentValueMap.
  const [{ data: invs }, { map: currentValue, displayCurrency }, rates] =
    await Promise.all([
      supabase
        .from("investments")
        .select("id, account_id, currency")
        .eq("is_active", true)
        .in("account_id", investmentAccountIds),
      getCurrentValueMap(),
      getRateMap(),
    ]);

  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const out = new Map<string, number>();
  for (const i of invs ?? []) {
    const acc = accountById.get(i.account_id);
    if (!acc) continue;
    // currentValue está em displayCurrency. Convertemos pra moeda da conta.
    const inDisplay = currentValue.get(i.id) ?? 0;
    const inAccCurrency = convertOrSame(
      inDisplay,
      displayCurrency,
      acc.currency,
      rates,
    );
    out.set(i.account_id, (out.get(i.account_id) ?? 0) + inAccCurrency);
  }
  return out;
}

function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function listAccountsForMonth(
  monthEndISO: string,
  position: "past" | "current" | "future",
  opts?: { includeArchived?: boolean },
): Promise<AccountWithBalance[]> {
  const accounts = await listAccounts(opts);
  const assetsByAccount = await getAssetsBalanceByAccount(accounts);

  if (position === "current") {
    return accounts.map((a) => ({
      ...a,
      displayBalance: Number(a.current_balance ?? 0),
      balanceMode: "current" as const,
      assetsBalance: assetsByAccount.get(a.id) ?? 0,
    }));
  }

  const supabase = await createClient();
  const today = todayISO();

  // 1. Deltas REAIS por conta (transações com date > monthEnd).
  const realDeltaByAccount = new Map<string, number>();
  const { data: futureTxs } = await supabase
    .from("transactions")
    .select("account_id, kind, amount_account, transfer_direction")
    .eq("is_historical_ir_only", false)
    .gt("date", monthEndISO);

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
    realDeltaByAccount.set(
      t.account_id,
      (realDeltaByAccount.get(t.account_id) ?? 0) + delta,
    );
  }

  // 2. Deltas PREVISTOS por conta (só pra futuro). Forecast vem em range
  //    [hoje, monthEnd]. getRecurrencesForecast trabalha em janela MENSAL —
  //    pra range multi-mês iteramos mês a mês.
  const forecastDeltaByAccount = new Map<string, { delta: number; rate: number | null }>();
  if (position === "future") {
    // Lista de YYYY-MM entre o mês corrente e o monthEnd inclusive
    const [tY, tM] = today.slice(0, 7).split("-").map(Number);
    const [eY, eM] = monthEndISO.slice(0, 7).split("-").map(Number);
    const months: string[] = [];
    let y = tY, m = tM;
    while (y < eY || (y === eY && m <= eM)) {
      months.push(`${y}-${String(m).padStart(2, "0")}`);
      m += 1;
      if (m > 12) { m = 1; y += 1; }
    }

    const rates = await getRateMap();

    const forecasts = await Promise.all(months.map((mm) => getRecurrencesForecast(mm)));

    for (const fc of forecasts) {
      for (const occ of fc.occurrences) {
        // Filtra: só ocorrências entre [hoje+1, monthEnd]. Excluímos hoje
        // (assumimos que o cron diário já materializou até hoje), mas se a
        // ocorrência for exatamente hoje ainda não materializada, ainda
        // entra (>= today seria conservador). Pra fail-proof, usamos > today.
        if (occ.date <= today) continue;
        if (occ.date > monthEndISO) continue;

        const acc = accounts.find((a) =>
          occ.kind === "transfer"
            ? false // tratamos transfer separado abaixo (precisa de from/to ids)
            : a.id === occ.accountId,
        );

        if (occ.kind === "income" || occ.kind === "expense") {
          if (!acc) continue;
          // Converte rule.currency → account.currency
          const amtInAcc = convertOrSame(
            occ.originalAmount,
            occ.originalCurrency,
            acc.currency,
            rates,
          );
          const signed = occ.kind === "income" ? amtInAcc : -amtInAcc;
          const prev = forecastDeltaByAccount.get(acc.id) ?? { delta: 0, rate: null };
          prev.delta += signed;
          forecastDeltaByAccount.set(acc.id, prev);
        }
        // Transfers: precisaríamos do account_id de from/to. ForecastOccurrence
        // tem só os nomes. Pra fail-proof, ignoramos transferências previstas
        // no per-account display — saldo total continua correto (transfer é
        // neutro), só a divisão entre contas pode ficar imprecisa. Marca
        // como TODO se vier a ser problema.
      }
    }
  }

  return accounts.map((a) => {
    const realDelta = realDeltaByAccount.get(a.id) ?? 0;
    const forecastDelta = forecastDeltaByAccount.get(a.id)?.delta ?? 0;
    const balance = Number(a.current_balance ?? 0) - realDelta + forecastDelta;
    return {
      ...a,
      displayBalance: balance,
      balanceMode: position === "past" ? ("historical" as const) : ("forecast" as const),
      // Ativos só fazem sentido no presente (não temos snapshot histórico
      // por ativo). Pra mês passado/futuro mostramos valor atual mesmo.
      assetsBalance: assetsByAccount.get(a.id) ?? 0,
    };
  });
}
