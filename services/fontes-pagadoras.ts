import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

/**
 * Fontes pagadoras — empresas/pessoas que pagam ao usuário recorrentemente.
 * Usado pra construir corretamente o quadro "Rendimentos Recebidos de PJ/PF"
 * do IRPF, com CNPJ, IRRF retido e INSS conforme o caso.
 */

export async function listFontesPagadoras(opts?: {
  includeInactive?: boolean;
  householdId?: string;
}): Promise<Tables<"fontes_pagadoras">[]> {
  const supabase = await createClient();
  let q = supabase
    .from("fontes_pagadoras")
    .select("*")
    .order("type")
    .order("name");
  if (!opts?.includeInactive) q = q.eq("is_active", true);
  if (opts?.householdId) q = q.eq("household_id", opts.householdId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getFontePagadora(
  id: string,
): Promise<Tables<"fontes_pagadoras"> | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fontes_pagadoras")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}
