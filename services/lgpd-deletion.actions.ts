"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserContext } from "@/services/auth";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Exclusão de conta verificável (LGPD art. 18 VI), decisão D22:
 *  - reauth (senha) obrigatória;
 *  - soft-deactivate imediato (is_active=false) → o app vira read-only / bloqueia;
 *  - grace de LGPD_DELETION_GRACE_DAYS dias pra arrependimento (cancelável);
 *  - cron executa o hard-delete (delete_account_complete) após o grace.
 */

export type DeletionState = { ok?: boolean; error?: string };

export async function requestAccountDeletion(password: string): Promise<DeletionState> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const admin = createAdminClient();
  // Multi-membro: por ora exige household de 1 pessoa (D23 trata transferência).
  const { data: members } = await admin
    .from("users")
    .select("id")
    .eq("household_id", ctx.household.id);
  if ((members?.length ?? 0) > 1) {
    return {
      error:
        "Há outros membros no lar. Remova os outros membros antes de excluir a conta (a exclusão apaga os dados compartilhados).",
    };
  }

  // Reauth: confirma a senha (signInWithPassword falha se incorreta).
  if (!ctx.email) return { error: "Conta sem e-mail — fale com o suporte." };
  const supabase = await createClient();
  const { error: reauthErr } = await supabase.auth.signInWithPassword({
    email: ctx.email,
    password,
  });
  if (reauthErr) return { error: "Senha incorreta. Confirme pra prosseguir." };

  // Soft-deactivate + agenda.
  const now = new Date().toISOString();
  await admin
    .from("users")
    .update({ is_active: false, deactivated_at: now })
    .eq("household_id", ctx.household.id);
  await admin.from("data_access_requests").insert({
    user_id: ctx.profile.id,
    request_type: "delete",
    status: "pending",
  });

  logger.info("LGPD: exclusão agendada", { householdId: ctx.household.id });
  return { ok: true };
}

export async function cancelAccountDeletion(): Promise<DeletionState> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };
  const admin = createAdminClient();
  await admin
    .from("users")
    .update({ is_active: true, deactivated_at: null })
    .eq("household_id", ctx.household.id);
  await admin
    .from("data_access_requests")
    .update({ status: "rejected", admin_notes: "Cancelado pelo titular" })
    .eq("user_id", ctx.profile.id)
    .eq("request_type", "delete")
    .eq("status", "pending");
  return { ok: true };
}

/**
 * Executa as exclusões cujo grace expirou. Chamado pelo cron. Idempotente:
 * a própria RPC apaga o pedido (cascade), então não reprocessa.
 */
export async function executePendingDeletions(): Promise<{ deleted: number }> {
  const admin = createAdminClient();
  const graceMs = env.LGPD_DELETION_GRACE_DAYS * 86_400_000;
  const cutoff = new Date(Date.now() - graceMs).toISOString();

  const { data: reqs } = await admin
    .from("data_access_requests")
    .select("id, user_id")
    .eq("request_type", "delete")
    .eq("status", "pending");

  let deleted = 0;
  for (const r of reqs ?? []) {
    const { data: u } = await admin
      .from("users")
      .select("household_id, is_active, deactivated_at")
      .eq("id", r.user_id)
      .maybeSingle();
    if (!u || u.is_active || !u.deactivated_at) continue;
    if (u.deactivated_at > cutoff) continue; // ainda no grace
    const { error } = await admin.rpc("delete_account_complete", {
      p_household_id: u.household_id,
    });
    if (error) {
      logger.error("LGPD: falha ao excluir", error, { householdId: u.household_id });
      continue;
    }
    deleted += 1;
  }
  return { deleted };
}
