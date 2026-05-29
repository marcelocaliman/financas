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

  // Moeda da fatura (default BRL) vs moeda da conta cartão
  const faturaCurrency = (args.data.currency ?? "BRL") as Currency;
  type AccBuilder = {
    select: (s: string) => {
      eq: (
        c: string,
        v: string,
      ) => { maybeSingle: () => Promise<{ data: { currency: Currency } | null }> };
    };
  };
  const { data: acc } = await (
    supabase.from as unknown as (t: string) => AccBuilder
  )("accounts")
    .select("currency")
    .eq("id", args.accountId)
    .maybeSingle();
  const accountCurrency = (acc?.currency ?? "BRL") as Currency;

  // NOTA: marco zero (app_start_date) NÃO se aplica a fatura de cartão.
  // O modelo cash basis do app já trata cartão corretamente: compras só
  // entram em "Saiu" quando a fatura é paga. E queremos as compras
  // visíveis em breakdown por categoria/mês — marcar como histórica-IR
  // tiraria delas dessas analytics. Vide /transacoes.ts:268-273.

  // Ciclo da fatura — resolve PARCELAS. period_end (fechamento) e due_date
  // (vencimento) vêm do próprio doc. Quando setados nas tx, o cálculo de
  // fatura usa essas datas em vez de date (que é a data da compra original
  // pra parcelas, podendo ser meses atrás).
  const billPeriodEnd = args.data.period_end ?? null;
  const billDueDate = args.data.due_date ?? null;

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
      return {
        payload: {
          household_id: args.householdId,
          created_by: args.userId,
          account_id: args.accountId,
          kind: isRefund ? "income" : "expense",
          date: item.date,
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
          date: item.date,
          amount: amountAccount,
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

  void normalizeDescription;
  return { ok: true, createdIds: inserted.map((r) => r.id), skippedCount };
}
