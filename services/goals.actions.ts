"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  targetAmount: z.coerce.number().positive(),
  currentAmount: z.coerce.number().nonnegative().default(0),
  currency: z.enum(["BRL", "EUR", "USD"]).default("BRL"),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  linkedAccountId: z.string().uuid().optional(),
});

const updateSchema = createSchema.extend({ id: z.string().uuid() });

export type GoalFormState = {
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

export async function createGoal(
  _prev: GoalFormState | undefined,
  formData: FormData,
): Promise<GoalFormState> {
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    targetAmount: formData.get("targetAmount"),
    currentAmount: formData.get("currentAmount") ?? 0,
    currency: formData.get("currency") || "BRL",
    targetDate: formData.get("targetDate") || undefined,
    linkedAccountId: formData.get("linkedAccountId") || undefined,
  });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { error } = await supabase.from("goals").insert({
    household_id: ctx.household.id,
    name: parsed.data.name.trim(),
    description: parsed.data.description?.trim() ?? null,
    target_amount: parsed.data.targetAmount,
    current_amount: parsed.data.currentAmount,
    currency: parsed.data.currency,
    target_date: parsed.data.targetDate ?? null,
    linked_account_id: parsed.data.linkedAccountId ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath("/metas");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateGoal(
  _prev: GoalFormState | undefined,
  formData: FormData,
): Promise<GoalFormState> {
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    targetAmount: formData.get("targetAmount"),
    currentAmount: formData.get("currentAmount") ?? 0,
    currency: formData.get("currency") || "BRL",
    targetDate: formData.get("targetDate") || undefined,
    linkedAccountId: formData.get("linkedAccountId") || undefined,
  });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update({
      name: parsed.data.name.trim(),
      description: parsed.data.description?.trim() ?? null,
      target_amount: parsed.data.targetAmount,
      current_amount: parsed.data.currentAmount,
      currency: parsed.data.currency,
      target_date: parsed.data.targetDate ?? null,
      linked_account_id: parsed.data.linkedAccountId ?? null,
    })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };
  revalidatePath("/metas");
  return { ok: true };
}

export async function archiveGoal(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update({ is_archived: true })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/metas");
  return { ok: true };
}

export async function restoreGoal(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update({ is_archived: false })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/metas");
  return { ok: true };
}

export async function deleteGoal(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/metas");
  return { ok: true };
}
