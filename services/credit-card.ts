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

export type CreditCardBillStatus =
  | "current" // ciclo aberto, ainda acumulando compras
  | "closed_pending" // fechada, aguardando pagamento (dueDate >= hoje)
  | "overdue" // fechada, dueDate já passou, sem pagamento
  | "paid"; // já paga (transfer detectado)

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
  status: CreditCardBillStatus;
  /** Dias até dueDate (negativo se atrasada) — null pra ciclo current */
  daysUntilDue: number | null;
  /** Valor já pago da fatura (transfers detectados) */
  paidAmount: number;
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
 * Janela da fatura ANTERIOR (a que acabou de fechar antes do ciclo atual).
 * Subtraindo um mês do periodStart/periodEnd de computeBillWindow.
 */
function previousBillWindow(
  current: ReturnType<typeof computeBillWindow>,
): { closeDate: string; dueDate: string; periodStart: string; periodEnd: string } {
  const shift = (iso: string, months: number): string => {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1 + months, d));
    return dt.toISOString().slice(0, 10);
  };
  return {
    closeDate: shift(current.closeDate, -1),
    dueDate: shift(current.dueDate, -1),
    periodStart: shift(current.periodStart, -1),
    periodEnd: shift(current.periodEnd, -1),
  };
}

function daysBetween(fromISO: string, toISO: string): number {
  const a = new Date(fromISO + "T00:00:00Z").getTime();
  const b = new Date(toISO + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86400000);
}

type BillWindow = ReturnType<typeof computeBillWindow>;

/**
 * Total assinado de uma fatura: soma despesas e SUBTRAI estornos/créditos
 * (kind=income), casando por bill_period_end (preciso pra parcelas) OU date no
 * range (fallback manual/legacy). Mesma semântica da SQL credit_card_bill_amount
 * — UI, notificações e auto-sync passam a bater.
 */
async function signedBillTotal(
  supabase: SupabaseClient,
  cardId: string,
  w: BillWindow,
): Promise<{ total: number; count: number }> {
  const { data } = await supabase
    .from("transactions")
    .select("amount_account, kind")
    .eq("account_id", cardId)
    .in("kind", ["expense", "income"])
    .or(
      `bill_period_end.eq.${w.periodEnd},and(bill_period_end.is.null,date.gte.${w.periodStart},date.lte.${w.periodEnd})`,
    );
  let total = 0;
  for (const t of data ?? []) {
    const v = Number(t.amount_account ?? 0);
    total += t.kind === "income" ? -v : v;
  }
  return { total, count: data?.length ?? 0 };
}

async function paidAmountFor(
  supabase: SupabaseClient,
  cardId: string,
  w: BillWindow,
): Promise<number> {
  const { data } = await supabase
    .from("transactions")
    .select("amount_account")
    .eq("account_id", cardId)
    .eq("kind", "transfer")
    .eq("transfer_direction", "in")
    .gte("date", w.closeDate)
    .lte("date", shiftDaysISO(w.dueDate, 30));
  return (data ?? []).reduce((s, t) => s + Number(t.amount_account ?? 0), 0);
}

/** Quantos ciclos fechados pra trás varremos atrás de fatura não paga. */
const MAX_PAST_BILL_CYCLES = 3;

/**
 * Retorna TODAS as faturas relevantes de cada cartão:
 *  - A fatura mais recente FECHADA mas ainda não paga (closed_pending / overdue)
 *  - O ciclo atual sendo formado, se tiver compras (current)
 *
 * "Paga" = transfer pra a conta do cartão entre [closeDate, dueDate+30d] com
 * soma >= 95% do valor da fatura (tolera multa/juros/desconto pequeno).
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

  const todayDate = new Date();
  const todayISO = todayDate.toISOString().slice(0, 10);
  const bills: CreditCardBill[] = [];

  for (const card of cards) {
    const closeDay = card.bill_close_day as number;
    const dueDay = (card.bill_due_day as number | null) ?? closeDay;
    const limit = card.credit_limit ? Number(card.credit_limit) : null;
    const cardId = card.id as string;

    const current = computeBillWindow(closeDay, dueDay, todayDate);

    // Varre os ciclos FECHADOS pra trás (até MAX_PAST_BILL_CYCLES) procurando
    // faturas não pagas — antes só o ciclo anterior era checado, então uma
    // fatura atrasada de 2+ meses ficava invisível. Para no primeiro ciclo já
    // pago (assume que o usuário paga em ordem cronológica).
    let pastWindow = previousBillWindow(current);
    for (let i = 0; i < MAX_PAST_BILL_CYCLES; i++) {
      const { total, count } = await signedBillTotal(supabase, cardId, pastWindow);
      if (total > 0.01) {
        const paidAmount = await paidAmountFor(supabase, cardId, pastWindow);
        const paid = paidAmount >= total * 0.95;
        if (paid) break; // ciclo pago → os anteriores presumivelmente também
        const daysUntilDue = daysBetween(todayISO, pastWindow.dueDate);
        bills.push({
          accountId: cardId,
          closeDate: pastWindow.closeDate,
          dueDate: pastWindow.dueDate,
          periodStart: pastWindow.periodStart,
          periodEnd: pastWindow.periodEnd,
          totalOpen: Math.round(total * 100) / 100,
          txCount: count,
          utilizationPct: limit && limit > 0 ? total / limit : null,
          status: daysUntilDue >= 0 ? "closed_pending" : "overdue",
          daysUntilDue,
          paidAmount: Math.round(paidAmount * 100) / 100,
        });
      }
      pastWindow = previousBillWindow(pastWindow);
    }

    // Ciclo atual sempre aparece (mesmo vazio — usuário precisa ver onde tá
    // formando), mas com status='current'
    const { total: curTotal, count: curCount } = await signedBillTotal(
      supabase,
      cardId,
      current,
    );
    bills.push({
      accountId: cardId,
      closeDate: current.closeDate,
      dueDate: current.dueDate,
      periodStart: current.periodStart,
      periodEnd: current.periodEnd,
      totalOpen: Math.round(curTotal * 100) / 100,
      txCount: curCount,
      utilizationPct: limit && limit > 0 ? curTotal / limit : null,
      status: "current",
      daysUntilDue: daysBetween(todayISO, current.dueDate),
      paidAmount: 0,
    });
  }

  // Ordena: pendentes/atrasadas primeiro (mais urgente), depois current
  bills.sort((a, b) => {
    const order = { overdue: 0, closed_pending: 1, current: 2, paid: 3 };
    return order[a.status] - order[b.status];
  });

  return bills;
}

function shiftDaysISO(iso: string, days: number): string {
  const dt = new Date(iso + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export type CardAccount = Tables<"accounts">;
