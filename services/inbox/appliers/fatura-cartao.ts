import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FaturaCartao } from "../document-types";

/**
 * Aplica uma fatura de cartão extraída: cria N transactions (uma por item),
 * pulando is_payment=true (pagamento da fatura anterior — não é gasto novo).
 *
 * NÃO atribui category_id automaticamente — fica null e o user categoriza
 * depois (ou as regras de auto-categorize pegam). Idealmente o user escolhe
 * o cartão de destino na hora de confirmar.
 */
export async function applyFaturaCartao(args: {
  householdId: string;
  userId: string;
  documentId: string;
  data: FaturaCartao;
  /** Conta de cartão pra qual associar as transações */
  accountId: string;
}): Promise<{ ok: true; createdIds: string[] } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const newItems = args.data.items.filter((i) => !i.is_payment && i.amount > 0);

  if (newItems.length === 0) {
    return { ok: false, error: "Nenhuma transação a aplicar (todos os itens são pagamento ou nulos)." };
  }

  const rows = newItems.map((item) => {
    const installmentLabel =
      item.installment_current != null && item.installment_total != null
        ? ` · ${item.installment_current}/${item.installment_total}`
        : "";
    return {
      household_id: args.householdId,
      created_by: args.userId,
      account_id: args.accountId,
      kind: "expense",
      date: item.date,
      description: `${item.description}${installmentLabel}`,
      amount: Math.abs(item.amount),
      amount_account: Math.abs(item.amount),
      currency: "BRL",
      category_source: "openai",
      tags: item.portador ? [`portador:${item.portador.toLowerCase().split(" ")[0]}`] : [],
      exclude_from_ir: false,
      is_historical_ir_only: false,
      is_recurring: false,
      metadata: {
        source: "openai_inbox",
        document_id: args.documentId,
        portador: item.portador,
        original_date: item.date,
        original_description: item.description,
        ...(item.installment_current != null && item.installment_total != null
          ? {
              parcela: `${item.installment_current}/${item.installment_total}`,
            }
          : {}),
      },
    };
  });

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
    .insert(rows)
    .select("id");

  if (error || !inserted) {
    return { ok: false, error: error?.message ?? "Falha ao inserir transações." };
  }

  return { ok: true, createdIds: inserted.map((r) => r.id) };
}
