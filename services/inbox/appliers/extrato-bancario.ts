import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ExtratoBancario } from "../document-types";

/**
 * Aplica extrato bancário extraído: cria N transactions (uma por movimento)
 * na conta indicada.
 *
 * Pula movimentos kind='transfer' e kind='fee' por padrão — esses precisam
 * de input humano (qual a conta destino da transferência, qual categoria).
 *
 * Modelo: amount positivo = income, amount negativo = expense.
 */
export async function applyExtratoBancario(args: {
  householdId: string;
  userId: string;
  documentId: string;
  data: ExtratoBancario;
  /** Conta destino dos lançamentos */
  accountId: string;
  /** Quais kinds aplicar (default: ['income', 'expense', 'interest']) */
  includeKinds?: Array<"income" | "expense" | "transfer" | "fee" | "interest">;
}): Promise<{ ok: true; createdIds: string[] } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const allowedKinds = new Set(
    args.includeKinds ?? ["income", "expense", "interest"],
  );

  const toApply = args.data.movements.filter((m) => allowedKinds.has(m.kind));

  if (toApply.length === 0) {
    return { ok: false, error: "Nenhum movimento aplicável (todos foram filtrados)." };
  }

  const rows = toApply.map((m) => {
    const isIncome = m.kind === "income" || m.kind === "interest" || (m.amount >= 0 && m.kind !== "expense" && m.kind !== "fee");
    const absAmount = Math.abs(m.amount);
    return {
      household_id: args.householdId,
      created_by: args.userId,
      account_id: args.accountId,
      kind: isIncome ? "income" : "expense",
      date: m.date,
      description: m.description,
      amount: absAmount,
      amount_account: absAmount,
      currency: "BRL",
      category_source: "openai",
      exclude_from_ir: false,
      is_historical_ir_only: false,
      is_recurring: false,
      metadata: {
        source: "openai_inbox",
        document_id: args.documentId,
        bank_name: args.data.bank_name,
        original_kind: m.kind,
      },
    };
  });

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
    .insert(rows)
    .select("id");

  if (error || !inserted) {
    return { ok: false, error: error?.message ?? "Falha ao inserir transações." };
  }

  return { ok: true, createdIds: inserted.map((r) => r.id) };
}
