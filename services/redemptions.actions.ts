"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";

const ruleSchema = z.object({
  investmentId: z.string().uuid(),
  destinationAccountId: z.string().uuid(),
  mode: z.enum(["reinvest", "fixed_amount", "percentage"]),
  suggestedAmount: z.coerce.number().optional(),
  percentage: z.coerce.number().optional(),
  dayOfMonth: z.coerce.number().int().min(1).max(31),
  notes: z.string().optional(),
});

const updateRuleSchema = ruleSchema.extend({ id: z.string().uuid() });

export type RuleFormState = {
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

export async function createYieldRule(
  _prev: RuleFormState | undefined,
  formData: FormData,
): Promise<RuleFormState> {
  const parsed = ruleSchema.safeParse({
    investmentId: formData.get("investmentId"),
    destinationAccountId: formData.get("destinationAccountId"),
    mode: formData.get("mode"),
    suggestedAmount: formData.get("suggestedAmount") || undefined,
    percentage: formData.get("percentage") || undefined,
    dayOfMonth: formData.get("dayOfMonth"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { error } = await supabase.from("yield_rules").insert({
    household_id: ctx.household.id,
    investment_id: parsed.data.investmentId,
    destination_account_id: parsed.data.destinationAccountId,
    mode: parsed.data.mode,
    suggested_amount: parsed.data.suggestedAmount ?? null,
    percentage: parsed.data.percentage ?? null,
    day_of_month: parsed.data.dayOfMonth,
    notes: parsed.data.notes ?? null,
  });
  if (error) return { error: error.message };

  await supabase.rpc("ensure_pending_intents", { p_months_ahead: 3 });
  revalidatePath("/resgates");
  return { ok: true };
}

export async function updateYieldRule(
  _prev: RuleFormState | undefined,
  formData: FormData,
): Promise<RuleFormState> {
  const parsed = updateRuleSchema.safeParse({
    id: formData.get("id"),
    investmentId: formData.get("investmentId"),
    destinationAccountId: formData.get("destinationAccountId"),
    mode: formData.get("mode"),
    suggestedAmount: formData.get("suggestedAmount") || undefined,
    percentage: formData.get("percentage") || undefined,
    dayOfMonth: formData.get("dayOfMonth"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("yield_rules")
    .update({
      investment_id: parsed.data.investmentId,
      destination_account_id: parsed.data.destinationAccountId,
      mode: parsed.data.mode,
      suggested_amount: parsed.data.suggestedAmount ?? null,
      percentage: parsed.data.percentage ?? null,
      day_of_month: parsed.data.dayOfMonth,
      notes: parsed.data.notes ?? null,
    })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };
  revalidatePath("/resgates");
  return { ok: true };
}

export async function archiveYieldRule(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("yield_rules").update({ is_active: false }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/resgates");
  return { ok: true };
}

export async function restoreYieldRule(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("yield_rules").update({ is_active: true }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/resgates");
  return { ok: true };
}

/**
 * Deleta a regra. Intents pendentes ou finalizados associados são apagados
 * em cascata (via FK). Saques já executados continuam existindo como
 * transactions (transfer_pair_id) — não são afetados.
 */
export async function deleteYieldRule(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("yield_rules").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/resgates");
  return { ok: true };
}

export async function executeRedemption(intentId: string, amount: number) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("execute_redemption", {
    p_intent_id: intentId,
    p_amount: amount,
  });
  if (error) return { error: error.message };
  revalidatePath("/resgates");
  revalidatePath("/dashboard");
  revalidatePath("/investimentos");
  revalidatePath("/transacoes");
  return { ok: true };
}

export async function skipRedemption(intentId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("skip_redemption", { p_intent_id: intentId });
  if (error) return { error: error.message };
  revalidatePath("/resgates");
  return { ok: true };
}
