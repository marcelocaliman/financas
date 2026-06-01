import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { FaturaCartao } from "../document-types";
import {
  applyDedupCounts,
  normalizeDescription,
  transactionDedupKey,
} from "../dedup";
import { computeAmountAccount } from "../currency-convert";
import type { Currency } from "@/types/database";

/**
 * Aplica fatura de cartão extraída.
 *
 * Comportamento de dedup:
 * - Cada item recebe chave (account, date, amount, normalized_desc)
 * - Conta ocorrências por chave no batch
 * - Conta ocorrências no DB (transactions existentes na conta no período)
 * - Insere max(0, batch - db) por chave
 *
 * Tratamento de sinais:
 * - Items com is_payment=true (pagamento da fatura anterior) → IGNORADOS
 * - Items com amount > 0 → expense (compra normal)
 * - Items com amount < 0 → income (estorno/devolução)
 */
export async function applyFaturaCartao(args: {
  householdId: string;
  userId: string;
  documentId: string;
  data: FaturaCartao;
  accountId: string;
}): Promise<
  | { ok: true; createdIds: string[]; skippedCount: number }
  | { ok: false; error: string }
> {
  const admin = createAdminClient();
  const supabase = await createClient();
  const itemsAfterPayment = args.data.items.filter((i) => !i.is_payment);

  if (itemsAfterPayment.length === 0) {
    return { ok: false, error: "Nenhum item aplicável (todos eram pagamentos)." };
  }

  // Moeda + config da fatura da conta cartão
  const faturaCurrency = (args.data.currency ?? "BRL") as Currency;
  type AccBuilder = {
    select: (s: string) => {
      eq: (
        c: string,
        v: string,
      ) => {
        maybeSingle: () => Promise<{
          data: {
            currency: Currency;
            bill_close_day: number | null;
            bill_due_day: number | null;
          } | null;
        }>;
      };
    };
  };
  const { data: acc } = await (
    supabase.from as unknown as (t: string) => AccBuilder
  )("accounts")
    .select("currency, bill_close_day, bill_due_day")
    .eq("id", args.accountId)
    .maybeSingle();
  const accountCurrency = (acc?.currency ?? "BRL") as Currency;

  // NOTA: marco zero (app_start_date) NÃO se aplica a fatura de cartão.
  // O modelo cash basis do app já trata cartão corretamente: compras só
  // entram em "Saiu" quando a fatura é paga. E queremos as compras
  // visíveis em breakdown por categoria/mês — marcar como histórica-IR
  // tiraria delas dessas analytics. Vide /transacoes.ts:268-273.

  // Ciclo da fatura — resolve PARCELAS. Quando temos due_date + bill_close_day
  // da conta, calculamos o period_end exato via função SQL (mesma usada por
  // credit_card_bill_amount), garantindo que o ciclo da fatura bata com o
  // cálculo do extrato. Se faltar info, usa o que veio do doc como fallback.
  const billDueDate = args.data.due_date ?? null;
  let billPeriodEnd: string | null = null;
  // Só bill_period_end é persistido (não há coluna bill_period_start). A janela
  // SQL retorna start+end juntos, mas só usamos o end.

  if (billDueDate && acc?.bill_close_day) {
    type RpcBuilder = {
      rpc: (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{
        data: Array<{ period_start: string; period_end: string }> | null;
      }>;
    };
    const { data: win } = await (admin as unknown as RpcBuilder).rpc(
      "bill_window_for_due_date",
      {
        p_close_day: acc.bill_close_day,
        p_due_day: acc.bill_due_day ?? acc.bill_close_day,
        p_due_date: billDueDate,
      },
    );
    billPeriodEnd = win?.[0]?.period_end ?? args.data.period_end ?? null;
  } else {
    billPeriodEnd = args.data.period_end ?? null;
  }

  /**
   * Data efetiva da tx no extrato, seguindo o modelo de parcela do banco
   * brasileiro: cada parcela N "bate" no cartão no mesmo dia-do-mês da
   * compra original, mas N-1 meses depois.
   *
   *   - Parcela N/M (N > 1): data = original + (N-1) meses
   *   - Parcela 1/M, sem parcela ou compra à vista: data = original
   *
   * Ex: DROGARIA VENANCIO comprado em 29/03/2026 em 3 parcelas:
   *     - Parcela 1/3 → 29/03/2026 (na fatura que fecha 26/04)
   *     - Parcela 2/3 → 29/04/2026 (na fatura que fecha 26/05)
   *     - Parcela 3/3 → 29/05/2026 (na fatura que fecha 26/06)
   *
   * Determinístico: mesma compra produz sempre o mesmo date, dedup
   * funciona em re-imports sem duplicar.
   */
  const effectiveTxDate = (
    purchaseDate: string,
    installmentCurrent: number | null,
    installmentTotal: number | null,
  ): string => {
    if (
      installmentCurrent != null &&
      installmentCurrent > 1 &&
      installmentTotal != null &&
      installmentTotal > 1
    ) {
      return addMonthsClamped(purchaseDate, installmentCurrent - 1);
    }
    return purchaseDate;
  };

  /**
   * Adiciona N meses preservando o dia-do-mês, com clamp pro último dia
   * válido (ex: 31/01 + 1 mês → 28/02 ou 29/02 se bissexto).
   */
  function addMonthsClamped(iso: string, months: number): string {
    const [y, m, d] = iso.split("-").map(Number);
    const totalMonth = m - 1 + months;
    const newYear = y + Math.floor(totalMonth / 12);
    const newMonth = ((totalMonth % 12) + 12) % 12; // 0-11, handles negatives
    const daysInMonth = new Date(Date.UTC(newYear, newMonth + 1, 0)).getUTCDate();
    const newDay = Math.min(d, daysInMonth);
    return `${newYear}-${String(newMonth + 1).padStart(2, "0")}-${String(newDay).padStart(2, "0")}`;
  }

  // Constrói rows com chave de dedup. Trata sinais: negativo = income (estorno).
  type Row = { payload: Record<string, unknown>; key: string };
  const rows: Row[] = await Promise.all(
    itemsAfterPayment.map(async (item) => {
      const absAmount = Math.abs(item.amount);
      const isRefund = item.amount < 0;
      const installmentLabel =
        item.installment_current != null && item.installment_total != null
          ? ` · ${item.installment_current}/${item.installment_total}`
          : "";
      const description = `${item.description}${installmentLabel}`;
      // amount = valor cobrado em faturaCurrency (já é a moeda do que entra na conta)
      // amount_account = converte se moeda do cartão for diferente da fatura
      const amountAccount = await computeAmountAccount({
        amount: absAmount,
        fromCurrency: faturaCurrency,
        accountCurrency,
        date: item.date,
      });
      const txDate = effectiveTxDate(
        item.date,
        item.installment_current ?? null,
        item.installment_total ?? null,
      );
      return {
        payload: {
          household_id: args.householdId,
          created_by: args.userId,
          account_id: args.accountId,
          kind: isRefund ? "income" : "expense",
          date: txDate,
          description,
          amount: absAmount,
          amount_account: amountAccount,
          currency: faturaCurrency,
          category_source: "ai",
          tags: item.portador
            ? [`portador:${item.portador.toLowerCase().split(" ")[0]}`]
            : [],
          exclude_from_ir: false,
          is_historical_ir_only: false,
          is_recurring: false,
          bill_period_end: billPeriodEnd,
          bill_due_date: billDueDate,
          metadata: {
            source: "openai_inbox",
            document_id: args.documentId,
            portador: item.portador,
            original_date: item.date,
            original_description: item.description,
            ...(isRefund ? { is_refund: true } : {}),
            ...(item.installment_current != null && item.installment_total != null
              ? { parcela: `${item.installment_current}/${item.installment_total}` }
              : {}),
            // Compra internacional: registra moeda original + valor original
            ...(item.original_amount != null && item.original_currency != null
              ? {
                  original_currency: item.original_currency,
                  original_amount: Math.abs(item.original_amount),
                }
              : {}),
          },
        },
        key: transactionDedupKey({
          accountId: args.accountId,
          date: txDate,
          // usa absAmount (= coluna `amount`) pra casar com a chave dos
          // existentes (que lê `amount`). Antes usava amountAccount e divergia
          // em cartão multimoeda, duplicando no reimport.
          amount: absAmount,
          description,
        }),
      };
    }),
  );

  // Busca existentes na conta no range de datas
  const dates = Array.from(new Set(rows.map((r) => r.payload.date as string))).sort();
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];

  type ExistingTx = {
    date: string;
    amount: string | number;
    description: string;
  };
  type ExistingBuilder = {
    select: (s: string) => {
      eq: (c: string, v: unknown) => {
        gte: (
          c: string,
          v: unknown,
        ) => {
          lte: (c: string, v: unknown) => Promise<{ data: ExistingTx[] | null }>;
        };
      };
    };
  };
  const { data: existing } = await (
    admin.from as unknown as (t: string) => ExistingBuilder
  )("transactions")
    .select("date, amount, description")
    .eq("account_id", args.accountId)
    .gte("date", minDate)
    .lte("date", maxDate);

  const existingCounts = new Map<string, number>();
  for (const tx of existing ?? []) {
    const key = transactionDedupKey({
      accountId: args.accountId,
      date: tx.date,
      amount: Number(tx.amount),
      description: tx.description,
    });
    existingCounts.set(key, (existingCounts.get(key) ?? 0) + 1);
  }

  const { toInsert, skippedCount } = applyDedupCounts(
    rows.map((r) => ({ item: r.payload, key: r.key })),
    existingCounts,
  );

  if (toInsert.length === 0) {
    return { ok: true, createdIds: [], skippedCount };
  }

  type InsertBuilder = {
    insert: (rows: Record<string, unknown>[]) => {
      select: (s: string) => Promise<{
        data: { id: string }[] | null;
        error: { message: string } | null;
      }>;
    };
  };
  const { data: inserted, error } = await (
    admin.from as unknown as (t: string) => InsertBuilder
  )("transactions")
    .insert(toInsert)
    .select("id");

  if (error || !inserted) {
    return { ok: false, error: error?.message ?? "Falha ao inserir transações." };
  }

  // Re-deriva o saldo do cartão a partir dos lançamentos — inserção em lote da
  // fatura (com parcelas/datas futuras) podia deixar o current_balance fora de
  // sincronia. Auto-cura; best-effort.
  try {
    await admin.rpc("recompute_account_balance", { p_account_id: args.accountId });
  } catch {
    /* não bloqueia a aplicação da fatura */
  }

  void normalizeDescription;
  return { ok: true, createdIds: inserted.map((r) => r.id), skippedCount };
}
