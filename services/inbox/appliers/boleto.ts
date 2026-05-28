import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Boleto } from "../document-types";

/**
 * Aplica boleto extraído: cria 1 transaction expense agendada pra data
 * de vencimento. Pra qualquer conta de origem (user escolhe na confirmação).
 *
 * Modelo do app: transações futuras existem como "agendadas" e o cron
 * advance-balances aplica o delta quando a data chega.
 */
export async function applyBoleto(args: {
  householdId: string;
  userId: string;
  documentId: string;
  data: Boleto;
  /** Conta corrente que vai pagar o boleto */
  accountId: string;
  /** Categoria opcional (user pode definir, default null) */
  categoryId?: string | null;
}): Promise<{ ok: true; createdIds: string[] } | { ok: false; error: string }> {
  const admin = createAdminClient();

  type Builder = {
    insert: (rows: Record<string, unknown>[]) => {
      select: (s: string) => Promise<{
        data: { id: string }[] | null;
        error: { message: string } | null;
      }>;
    };
  };

  const { data: inserted, error } = await (
    admin.from as unknown as (t: string) => Builder
  )("transactions")
    .insert([
      {
        household_id: args.householdId,
        created_by: args.userId,
        account_id: args.accountId,
        kind: "expense",
        date: args.data.due_date,
        description: `${args.data.payee_name} · ${args.data.description}`,
        amount: args.data.amount,
        amount_account: args.data.amount,
        currency: "BRL",
        category_id: args.categoryId ?? null,
        category_source: "openai",
        exclude_from_ir: false,
        is_historical_ir_only: false,
        is_recurring: false,
        metadata: {
          source: "openai_inbox",
          document_id: args.documentId,
          payee_name: args.data.payee_name,
          payee_cnpj_cpf: args.data.payee_cnpj_cpf,
          barcode: args.data.barcode,
        },
      },
    ])
    .select("id");

  if (error || !inserted) {
    return { ok: false, error: error?.message ?? "Falha ao criar transação." };
  }

  return { ok: true, createdIds: inserted.map((r) => r.id) };
}
