"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";

const paySchema = z.object({
  cardAccountId: z.string().uuid(),
  amount: z.coerce.number().positive("Valor do pagamento precisa ser positivo."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  /** Conta de onde sai o pagamento. Default: payment_account_id do cartão. */
  fromAccountId: z.string().uuid().optional(),
});

/**
 * Registra o pagamento de uma fatura: cria a transferência conta→cartão (que
 * abate o saldo do cartão) e recalcula os saldos. É o "marquei como paga".
 */
export async function payCreditCardBill(input: {
  cardAccountId: string;
  amount: number;
  date: string;
  fromAccountId?: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const parsed = paySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();

  // Conta de origem: a informada, senão a payment_account_id do cartão.
  let fromAccountId = parsed.data.fromAccountId;
  const { data: card } = await supabase
    .from("accounts")
    .select("id, name, payment_account_id, type")
    .eq("id", parsed.data.cardAccountId)
    .maybeSingle();
  if (!card || card.type !== "credit_card") {
    return { error: "Cartão não encontrado." };
  }
  fromAccountId = fromAccountId ?? card.payment_account_id ?? undefined;
  if (!fromAccountId) {
    return {
      error:
        "Defina a conta de pagamento do cartão (em editar conta) ou escolha de onde sai o pagamento.",
    };
  }
  if (fromAccountId === parsed.data.cardAccountId) {
    return { error: "A conta de origem deve ser diferente do cartão." };
  }

  const { error } = await supabase.rpc("create_transfer", {
    p_from_account_id: fromAccountId,
    p_to_account_id: parsed.data.cardAccountId,
    p_amount: parsed.data.amount,
    p_date: parsed.data.date,
    p_description: `Pagamento de fatura — ${card.name}`,
    p_amount_to: null,
  });
  if (error) return { error: error.message };

  // Re-deriva os saldos (cartão + conta de origem) — barato e idempotente.
  try {
    await supabase.rpc("recompute_household_balances");
  } catch {
    /* não bloqueia */
  }

  revalidatePath("/contas");
  revalidatePath("/dashboard");
  revalidatePath("/transacoes");
  return { ok: true };
}
