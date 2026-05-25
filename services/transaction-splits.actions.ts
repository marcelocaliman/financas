"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const splitSchema = z.object({
  categoryId: z.string().uuid().nullable(),
  amount: z.coerce.number().positive(),
  description: z.string().optional().nullable(),
});

const schema = z.object({
  transactionId: z.string().uuid(),
  splits: z.array(splitSchema).min(2, "Splits precisam de pelo menos 2 linhas."),
});

export type SplitsState = { ok?: boolean; error?: string };

/**
 * Substitui (delete + insert) os splits de uma transaction.
 * Valida que soma dos splits == amount da parent (com tolerância de 1 centavo).
 */
export async function setTransactionSplits(
  input: z.input<typeof schema>,
): Promise<SplitsState> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .select("amount, household_id")
    .eq("id", parsed.data.transactionId)
    .maybeSingle();
  if (txErr || !tx) return { error: "Transaction não encontrada." };

  const total = parsed.data.splits.reduce((s, x) => s + x.amount, 0);
  const txAmount = Number(tx.amount);
  if (Math.abs(total - txAmount) > 0.01) {
    return {
      error: `Soma dos splits (R$ ${total.toFixed(2)}) precisa bater com o total da transaction (R$ ${txAmount.toFixed(2)}).`,
    };
  }

  // Substitui (delete antigos + insert novos)
  await supabase
    .from("transaction_splits")
    .delete()
    .eq("transaction_id", parsed.data.transactionId);

  const rows = parsed.data.splits.map((s) => ({
    transaction_id: parsed.data.transactionId,
    category_id: s.categoryId,
    amount: s.amount,
    description: s.description?.trim() || null,
  }));
  const { error: insertErr } = await supabase.from("transaction_splits").insert(rows);
  if (insertErr) return { error: insertErr.message };

  for (const p of ["/transacoes", "/dashboard", "/relatorios"]) revalidatePath(p);
  return { ok: true };
}

export async function deleteTransactionSplits(
  transactionId: string,
): Promise<SplitsState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("transaction_splits")
    .delete()
    .eq("transaction_id", transactionId);
  if (error) return { error: error.message };
  for (const p of ["/transacoes", "/dashboard", "/relatorios"]) revalidatePath(p);
  return { ok: true };
}
