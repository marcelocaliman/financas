import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

/**
 * Cálculos de cartão de crédito: período da fatura, total aberto, próximo
 * vencimento. Independente de provedor — usa close_day/due_day da conta.
 */

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
 * Semântica de close_day (alinhada com bancos brasileiros): close_day é o
 * dia em que a fatura FECHA/É GERADA. O ciclo contém transações do close_day
 * do mês anterior (inclusivo) até o dia ANTERIOR ao close_day atual (inclusivo).
 *
 * Ex: close=27, due=5. Hoje=20/05 (ainda não fechou esse mês):
 *   - Fatura abre: 27/04
 *   - Fatura fecha: 27/05 (período termina em 26/05)
 *   - Vence: 05/06
 */
export function computeBillWindow(
  closeDay: number,
  dueDay: number,
  today: Date = new Date(),
): { closeDate: string; dueDate: string; periodStart: string; periodEnd: string } {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth() + 1; // 1-12
  const d = today.getUTCDate();

  // Fatura desse mês já fechou? (close_day inclusivo significa que no DIA
  // close_day a fatura ainda tá aberta — ela fecha na transição pro dia seguinte)
  const thisMonthClose = clampDay(closeDay, y, m);
  const alreadyClosed = d > thisMonthClose;

  const targetY = alreadyClosed ? (m === 12 ? y + 1 : y) : y;
  const targetM = alreadyClosed ? (m === 12 ? 1 : m + 1) : m;
  const closeD = clampDay(closeDay, targetY, targetM);

  // Vencimento: mesmo mês do fechamento se due > close, próximo se due <= close
  const dueY = dueDay > closeDay ? targetY : (targetM === 12 ? targetY + 1 : targetY);
  const dueM = dueDay > closeDay ? targetM : (targetM === 12 ? 1 : targetM + 1);
  const dueD = clampDay(dueDay, dueY, dueM);

  // Período: do close_day do mês anterior (inclusivo) ao dia ANTES do close atual.
  const prevY = targetM === 1 ? targetY - 1 : targetY;
  const prevM = targetM === 1 ? 12 : targetM - 1;
  const prevCloseD = clampDay(closeDay, prevY, prevM);
  const periodStart = dateISO(prevY, prevM, prevCloseD);

  // periodEnd = close_day - 1 dia. Se close=1, vira último dia do mês anterior.
  const periodEnd = (() => {
    if (closeD > 1) return dateISO(targetY, targetM, closeD - 1);
    const lastPrevM = targetM === 1 ? 12 : targetM - 1;
    const lastPrevY = targetM === 1 ? targetY - 1 : targetY;
    return dateISO(lastPrevY, lastPrevM, lastDayOfMonth(lastPrevY, lastPrevM));
  })();

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
