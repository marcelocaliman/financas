import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

/**
 * Cálculos de cartão de crédito: período da fatura, total aberto, próximo
 * vencimento. Independente de provedor — usa close_day/due_day da conta.
 */

/**
 * IDs das contas tipo cartão de crédito do household ativo. Usado pra excluir
 * compras de cartão dos KPIs de fluxo (modelo cash basis): card spending não
 * conta como Saiu até a fatura ser paga.
 *
 * NOTA: incluímos contas inativas também — transações antigas podem ter sido
 * feitas em cartões hoje desativados, e ainda assim devem ser excluídas dos
 * agregados de cash.
 */
export async function getCreditCardAccountIds(
  supabase?: SupabaseClient,
): Promise<string[]> {
  const sb = supabase ?? (await createClient());
  const { data } = await sb
    .from("accounts")
    .select("id")
    .eq("type", "credit_card");
  return (data ?? []).map((r) => r.id as string);
}

export type CreditCardBill = {
  accountId: string;
  closeDate: string; // ISO — quando a fatura fecha
  dueDate: string; // ISO — quando vence
  /** Período coberto: de (closeDate do mês anterior + 1) até closeDate */
  periodStart: string;
  periodEnd: string;
  totalOpen: number;
  txCount: number;
  /** Uso vs limite (0-1) — null se sem limite cadastrado */
  utilizationPct: number | null;
};

function lastDayOfMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function clampDay(day: number, y: number, m: number): number {
  return Math.min(day, lastDayOfMonth(y, m));
}

function dateISO(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Calcula a fatura ATUALMENTE ABERTA pra um cartão.
 *
 * Semântica de close_day INCLUSIVO (alinhada com bancos brasileiros):
 * close_day é o dia em que a fatura fecha — compras DESSE dia ainda entram
 * na fatura que fecha. O ciclo cobre do dia SEGUINTE ao close_day do mês
 * anterior até o close_day atual (incluso).
 *
 * Ex: close=26, due=5. Hoje=20/05 (ainda não fechou esse mês):
 *   - Fatura abre: 27/04 (dia seguinte ao close anterior)
 *   - Fatura fecha: 26/05 (período termina em 26/05, incluso)
 *   - Vence: 05/06
 *
 * Espelha a função SQL public.bill_window_for_due_date — ambas precisam
 * usar a mesma semântica pra cálculos baterem.
 */
export function computeBillWindow(
  closeDay: number,
  dueDay: number,
  today: Date = new Date(),
): { closeDate: string; dueDate: string; periodStart: string; periodEnd: string } {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth() + 1; // 1-12
  const d = today.getUTCDate();

  // Fatura desse mês já fechou? close_day inclusivo: no DIA close_day a
  // fatura ainda tá aberta — fecha na transição pro dia seguinte.
  const thisMonthClose = clampDay(closeDay, y, m);
  const alreadyClosed = d > thisMonthClose;

  const targetY = alreadyClosed ? (m === 12 ? y + 1 : y) : y;
  const targetM = alreadyClosed ? (m === 12 ? 1 : m + 1) : m;
  const closeD = clampDay(closeDay, targetY, targetM);

  // Vencimento: mesmo mês do fechamento se due > close, próximo se due <= close
  const dueY = dueDay > closeDay ? targetY : (targetM === 12 ? targetY + 1 : targetY);
  const dueM = dueDay > closeDay ? targetM : (targetM === 12 ? 1 : targetM + 1);
  const dueD = clampDay(dueDay, dueY, dueM);

  // Período: do dia SEGUINTE ao close_day do mês anterior até o close_day
  // atual (incluso). Ex: close=26, ciclo Mai = [27/04, 26/05].
  const prevY = targetM === 1 ? targetY - 1 : targetY;
  const prevM = targetM === 1 ? 12 : targetM - 1;
  const prevCloseD = clampDay(closeDay, prevY, prevM);
  // periodStart = prevClose + 1 dia. Se prevClose == último dia do mês, vira dia 1 do mês alvo.
  const periodStart = (() => {
    const prevLastDay = lastDayOfMonth(prevY, prevM);
    if (prevCloseD < prevLastDay) return dateISO(prevY, prevM, prevCloseD + 1);
    return dateISO(targetY, targetM, 1);
  })();
  const periodEnd = dateISO(targetY, targetM, closeD);

  return {
    closeDate: dateISO(targetY, targetM, closeD),
    dueDate: dateISO(dueY, dueM, dueD),
    periodStart,
    periodEnd,
  };
}

/**
 * Retorna a fatura aberta de cada cartão de crédito ativo do household.
 */
export async function getOpenCreditCardBills(): Promise<CreditCardBill[]> {
  const supabase = await createClient();

  const { data: cards } = await supabase
    .from("accounts")
    .select("id, credit_limit, bill_close_day, bill_due_day")
    .eq("type", "credit_card")
    .eq("is_active", true)
    .not("bill_close_day", "is", null);

  if (!cards || cards.length === 0) return [];

  const today = new Date();
  const bills: CreditCardBill[] = [];

  for (const card of cards) {
    const closeDay = card.bill_close_day as number;
    const dueDay = (card.bill_due_day as number | null) ?? closeDay;
    const window = computeBillWindow(closeDay, dueDay, today);

    // Fatura aberta = soma de TODAS as despesas no ciclo, incluindo
    // is_historical_ir_only=true (marco zero / carryover de fatura
    // pré-existente). Esses precisam contar pra fatura mesmo sem poluir
    // o dashboard/orçamento/transações do mês.
    const { data: txs } = await supabase
      .from("transactions")
      .select("amount_account")
      .eq("account_id", card.id as string)
      .eq("kind", "expense")
      .gte("date", window.periodStart)
      .lte("date", window.periodEnd);

    const totalOpen = (txs ?? []).reduce((s, t) => s + Number(t.amount_account ?? 0), 0);
    const limit = card.credit_limit ? Number(card.credit_limit) : null;

    bills.push({
      accountId: card.id as string,
      closeDate: window.closeDate,
      dueDate: window.dueDate,
      periodStart: window.periodStart,
      periodEnd: window.periodEnd,
      totalOpen: Math.round(totalOpen * 100) / 100,
      txCount: txs?.length ?? 0,
      utilizationPct: limit && limit > 0 ? totalOpen / limit : null,
    });
  }

  return bills;
}

export type CardAccount = Tables<"accounts">;
