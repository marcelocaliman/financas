"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";

export type YearMgmtState = { ok?: boolean; error?: string };

/**
 * Arquiva um ano-base — esconde da lista principal mas mantém todos os dados
 * (snapshots, DARFs, anotações). Reversível via unarchive.
 */
export async function archiveYear(
  year: number,
  reason?: string,
): Promise<YearMgmtState> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("ir_year_metadata")
    .upsert(
      {
        household_id: ctx.household.id,
        year,
        archived_at: new Date().toISOString(),
        archive_reason: reason ?? null,
      },
      { onConflict: "household_id,year" },
    );
  if (error) return { error: error.message };

  revalidatePath("/ir");
  revalidatePath("/ir", "layout");
  return { ok: true };
}

export async function unarchiveYear(year: number): Promise<YearMgmtState> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("ir_year_metadata")
    .update({
      archived_at: null,
      archive_reason: null,
    })
    .eq("household_id", ctx.household.id)
    .eq("year", year);
  if (error) return { error: error.message };

  revalidatePath("/ir");
  revalidatePath("/ir", "layout");
  return { ok: true };
}

/**
 * Apaga TODOS os dados de um ano-base. Destrutivo e irreversível.
 * Remove:
 *   - ir_year_snapshots (snapshot fechado)
 *   - ir_darfs (DARFs gerados)
 *   - ir_deductible_payments (pagamentos dedutíveis)
 *   - ir_other_incomes (rendas manuais)
 *   - carne_leao_mensal (carnê-leão)
 *   - ir_prior_year_balances (saldos anteriores)
 *   - ir_year_metadata (arquivamento)
 *   - accountant_notes (anotações do contador)
 *
 * NÃO remove transactions, accounts, investments (são do dia-a-dia, não do ano).
 *
 * Requer `confirmYearInput` igual ao year pra prevenir acidente.
 */
export async function deleteYearAll(
  year: number,
  confirmYearInput: number,
): Promise<YearMgmtState> {
  if (confirmYearInput !== year) {
    return { error: "Confirmação não bate com o ano. Operação cancelada." };
  }
  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const householdId = ctx.household.id;

  // Best-effort: nenhum dos deletes é fatal isoladamente
  await Promise.all([
    supabase.from("ir_year_snapshots").delete().eq("household_id", householdId).eq("year", year),
    supabase.from("ir_darfs").delete().eq("household_id", householdId).eq("year", year),
    supabase.from("ir_deductible_payments").delete().eq("household_id", householdId).eq("year", year),
    supabase.from("ir_other_incomes").delete().eq("household_id", householdId).eq("year", year),
    supabase.from("carne_leao_mensal").delete().eq("household_id", householdId).eq("year", year),
    supabase
      .from("ir_prior_year_balances")
      .delete()
      .eq("household_id", householdId)
      .eq("year", year - 1), // saldos de Y-1 são usados pela declaração de Y
    supabase.from("ir_year_metadata").delete().eq("household_id", householdId).eq("year", year),
    supabase
      .from("accountant_notes")
      .delete()
      .eq("household_id", householdId)
      .eq("year", year),
  ]);

  revalidatePath("/ir", "layout");
  return { ok: true };
}
