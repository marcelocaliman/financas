"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Apaga TODOS os dados do household, mantendo perfil + lar.
 * Re-seed das categorias padrão.
 *
 * Operação irreversível — UI exige confirmação por digitação.
 */
export async function resetHouseholdData(): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reset_household_data");
  if (error) return { error: error.message };

  // Invalida tudo
  for (const p of [
    "/",
    "/dashboard",
    "/transacoes",
    "/contas",
    "/categorias",
    "/investimentos",
    "/resgates",
    "/metas",
    "/patrimonio",
    "/analise",
    "/configuracoes",
  ]) {
    revalidatePath(p);
  }
  return { ok: true };
}
