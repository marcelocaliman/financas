"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Desfaz uma ação do histórico (activity_log) — reverte insert/update/delete
 * usando o snapshot, via a função SQL undo_activity (security definer, escopada
 * ao household). Revalida as páginas que podem ter mudado.
 */
export async function undoActivity(
  logId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await (
    supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: { ok?: boolean; error?: string } | null; error: unknown }>
  )("undo_activity", { p_log_id: logId });

  if (error) return { error: "Falha ao desfazer." };
  const res = data;
  if (!res || res.error) return { error: res?.error ?? "Não deu pra desfazer." };

  for (const p of [
    "/dashboard",
    "/transacoes",
    "/contas",
    "/investimentos",
    "/resgates",
    "/recorrentes",
    "/metas",
    "/dividas",
    "/patrimonio",
    "/configuracoes/atividade",
  ]) {
    revalidatePath(p);
  }
  return { ok: true };
}
