"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";

/**
 * Atualização de valor de imóvel — Lei 14.973/2024 (Programa de Atualização
 * Patrimonial Imobiliária).
 *
 * - Pessoa física: alíquota 4% sobre a diferença (valor atualizado − valor declarado)
 * - Pessoa jurídica: 6%
 * - Pagamento via DARF até o vencimento publicado pela Receita
 * - O imóvel passa a constar pelo novo valor; GCAP futuro é calculado sobre o NOVO custo
 *
 * IMPORTANTE: regra vale só pra exercícios 2024+ (verificar atualizações da norma).
 */

const schema = z.object({
  physicalAssetId: z.string().uuid(),
  revaluationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  previousValue: z.coerce.number().nonnegative(),
  newValue: z.coerce.number().positive(),
  taxRate: z.coerce.number().min(0.01).max(0.20).default(0.04),
  darfPaymentReference: z.string().optional().nullable(),
  filerId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type RevaluationFormState = {
  ok?: boolean;
  error?: string;
};

export async function createPropertyRevaluation(
  _prev: RevaluationFormState | undefined,
  formData: FormData,
): Promise<RevaluationFormState> {
  const parsed = schema.safeParse({
    physicalAssetId: formData.get("physicalAssetId"),
    revaluationDate: formData.get("revaluationDate"),
    previousValue: formData.get("previousValue"),
    newValue: formData.get("newValue"),
    taxRate: formData.get("taxRate") ?? 0.04,
    darfPaymentReference: formData.get("darfPaymentReference") || null,
    filerId: formData.get("filerId") || null,
    notes: formData.get("notes") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  if (parsed.data.newValue <= parsed.data.previousValue) {
    return { error: "Novo valor precisa ser maior que o anterior." };
  }

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const difference = parsed.data.newValue - parsed.data.previousValue;
  const taxPaid = Math.round(difference * parsed.data.taxRate * 100) / 100;

  const supabase = await createClient();
  const { error } = await supabase.from("physical_asset_revaluations").insert({
    household_id: ctx.household.id,
    physical_asset_id: parsed.data.physicalAssetId,
    revaluation_date: parsed.data.revaluationDate,
    previous_value: parsed.data.previousValue,
    new_value: parsed.data.newValue,
    difference,
    tax_rate: parsed.data.taxRate,
    tax_paid: taxPaid,
    darf_payment_reference: parsed.data.darfPaymentReference?.trim() || null,
    filer_id: parsed.data.filerId || null,
    notes: parsed.data.notes?.trim() || null,
  });
  if (error) return { error: error.message };

  // Atualiza o valor atual do imóvel pra refletir
  await supabase
    .from("physical_assets")
    .update({ current_value: parsed.data.newValue })
    .eq("id", parsed.data.physicalAssetId);

  revalidatePath("/patrimonio");
  revalidatePath("/ir", "layout");
  return { ok: true };
}

export async function deletePropertyRevaluation(id: string): Promise<RevaluationFormState> {
  const supabase = await createClient();
  const { error } = await supabase.from("physical_asset_revaluations").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/ir", "layout");
  return { ok: true };
}
