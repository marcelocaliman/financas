"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  investmentId: z.string().uuid(),
  amount: z.coerce.number().positive("Valor deve ser positivo."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  debitAccountId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export type ContributionFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function parseErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of error.issues) {
    const p = i.path.join(".");
    if (p && !out[p]) out[p] = i.message;
  }
  return out;
}

export async function addToFixedIncome(
  _prev: ContributionFormState | undefined,
  formData: FormData,
): Promise<ContributionFormState> {
  const parsed = schema.safeParse({
    investmentId: formData.get("investmentId"),
    amount: formData.get("amount"),
    date: formData.get("date"),
    debitAccountId: formData.get("debitAccountId") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_to_fixed_income", {
    p_investment_id: parsed.data.investmentId,
    p_amount: parsed.data.amount,
    p_date: parsed.data.date,
    p_debit_account_id: parsed.data.debitAccountId ?? null,
    p_notes: parsed.data.notes ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath("/investimentos");
  revalidatePath("/dashboard");
  revalidatePath("/transacoes");
  return { ok: true };
}
