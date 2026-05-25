"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";

const schema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  accountId: z.string().uuid().optional().nullable(),
  investmentId: z.string().uuid().optional().nullable(),
  physicalAssetId: z.string().uuid().optional().nullable(),
  balance: z.coerce.number().nonnegative(),
  notes: z.string().optional().nullable(),
});

export type PriorYearFormState = {
  ok?: boolean;
  error?: string;
};

/**
 * Salva (insert ou update) o saldo de 31/12 de UM bem.
 * Identifica o bem pelo (account_id | investment_id | physical_asset_id).
 */
export async function upsertPriorYearBalance(
  formData: FormData,
): Promise<PriorYearFormState> {
  const parsed = schema.safeParse({
    year: formData.get("year"),
    accountId: formData.get("accountId") || null,
    investmentId: formData.get("investmentId") || null,
    physicalAssetId: formData.get("physicalAssetId") || null,
    balance: formData.get("balance"),
    notes: formData.get("notes") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  }

  // Exatamente 1 dos 3 FKs (replica check constraint)
  const refs = [parsed.data.accountId, parsed.data.investmentId, parsed.data.physicalAssetId]
    .filter(Boolean);
  if (refs.length !== 1) {
    return { error: "Selecione exatamente 1 bem (conta, investimento OU bem físico)." };
  }

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();

  // Procura entry existente
  const eqColumn = parsed.data.accountId
    ? "account_id"
    : parsed.data.investmentId
      ? "investment_id"
      : "physical_asset_id";
  const eqValue =
    parsed.data.accountId ?? parsed.data.investmentId ?? parsed.data.physicalAssetId!;

  const { data: existing } = await supabase
    .from("ir_prior_year_balances")
    .select("id")
    .eq("household_id", ctx.household.id)
    .eq("year", parsed.data.year)
    .eq(eqColumn, eqValue)
    .maybeSingle();

  const payload = {
    household_id: ctx.household.id,
    year: parsed.data.year,
    account_id: parsed.data.accountId ?? null,
    investment_id: parsed.data.investmentId ?? null,
    physical_asset_id: parsed.data.physicalAssetId ?? null,
    balance: parsed.data.balance,
    notes: parsed.data.notes?.trim() ?? null,
  };

  const { error } = existing
    ? await supabase.from("ir_prior_year_balances").update(payload).eq("id", existing.id)
    : await supabase.from("ir_prior_year_balances").insert(payload);

  if (error) return { error: error.message };
  revalidatePath("/ir", "layout");
  return { ok: true };
}

export async function deletePriorYearBalance(id: string): Promise<PriorYearFormState> {
  const supabase = await createClient();
  const { error } = await supabase.from("ir_prior_year_balances").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/ir", "layout");
  return { ok: true };
}
