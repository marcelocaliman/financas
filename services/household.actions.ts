"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Gera um novo código de convite pro lar do usuário logado.
 * Apenas admin. Retorna o código gerado.
 */
export async function generateHouseholdInvite(): Promise<ActionResult<{ code: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_household_invite");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/configuracoes");
  return { ok: true, data: { code: data as string } };
}

/**
 * Revoga um convite ativo (não pode ser usado).
 */
export async function revokeHouseholdInvite(code: string): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_household_invite", { p_code: code });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/configuracoes");
  return { ok: true, data: null };
}
