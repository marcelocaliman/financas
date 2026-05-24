"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isPlatformAdmin,
  recordAdminAction,
  requirePlatformAdmin,
} from "@/services/platform-admin";

export type AdminActionResult = { ok?: boolean; error?: string };

// ============================================================================
// Promote/Revoke platform admin
// ============================================================================

export async function promoteToPlatformAdmin(
  userId: string,
  notes?: string,
): Promise<AdminActionResult> {
  if (!(await isPlatformAdmin())) return { error: "Acesso negado." };
  const parsed = z.string().uuid().safeParse(userId);
  if (!parsed.success) return { error: "ID inválido." };

  const admin = createAdminClient();
  const { error } = await admin.from("platform_admins").insert({
    user_id: userId,
    notes: notes ?? null,
  });
  if (error) return { error: error.message };

  await recordAdminAction({
    action: "platform_admin.grant",
    targetUserId: userId,
    details: { notes },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function revokePlatformAdmin(
  userId: string,
): Promise<AdminActionResult> {
  if (!(await isPlatformAdmin())) return { error: "Acesso negado." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("platform_admins")
    .delete()
    .eq("user_id", userId);
  if (error) return { error: error.message };

  await recordAdminAction({
    action: "platform_admin.revoke",
    targetUserId: userId,
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

// ============================================================================
// Subscription management
// ============================================================================

const tierEnum = z.enum(["free", "pro", "family", "lifetime"]);
const statusEnum = z.enum([
  "active",
  "trialing",
  "past_due",
  "cancelled",
  "suspended",
]);

export async function updateSubscription(
  householdId: string,
  patch: {
    tier?: "free" | "pro" | "family" | "lifetime";
    status?: "active" | "trialing" | "past_due" | "cancelled" | "suspended";
    renewsAt?: string | null;
    trialEndsAt?: string | null;
  },
): Promise<AdminActionResult> {
  if (!(await isPlatformAdmin())) return { error: "Acesso negado." };
  const admin = createAdminClient();

  type HouseholdUpdate = {
    subscription_tier?: "free" | "pro" | "family" | "lifetime";
    subscription_status?: "active" | "trialing" | "past_due" | "cancelled" | "suspended";
    subscription_renews_at?: string | null;
    trial_ends_at?: string | null;
  };
  const update: HouseholdUpdate = {};
  if (patch.tier && tierEnum.safeParse(patch.tier).success) {
    update.subscription_tier = patch.tier;
  }
  if (patch.status && statusEnum.safeParse(patch.status).success) {
    update.subscription_status = patch.status;
  }
  if (patch.renewsAt !== undefined) update.subscription_renews_at = patch.renewsAt;
  if (patch.trialEndsAt !== undefined) update.trial_ends_at = patch.trialEndsAt;

  const { error } = await admin
    .from("households")
    .update(update)
    .eq("id", householdId);
  if (error) return { error: error.message };

  await recordAdminAction({
    action: "subscription.update",
    targetHouseholdId: householdId,
    details: patch,
  });
  revalidatePath("/admin/subscriptions");
  revalidatePath(`/admin/households/${householdId}`);
  return { ok: true };
}

// ============================================================================
// Suspend / unsuspend household
// ============================================================================

export async function suspendHousehold(
  householdId: string,
  reason: string,
): Promise<AdminActionResult> {
  if (!(await isPlatformAdmin())) return { error: "Acesso negado." };
  if (!reason || reason.trim().length < 5) {
    return { error: "Motivo é obrigatório (mínimo 5 caracteres)." };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("households")
    .update({
      subscription_status: "suspended",
      suspended_reason: reason,
      suspended_at: new Date().toISOString(),
    })
    .eq("id", householdId);
  if (error) return { error: error.message };

  await recordAdminAction({
    action: "household.suspend",
    targetHouseholdId: householdId,
    details: { reason },
  });
  revalidatePath("/admin/households");
  revalidatePath(`/admin/households/${householdId}`);
  return { ok: true };
}

export async function unsuspendHousehold(
  householdId: string,
): Promise<AdminActionResult> {
  if (!(await isPlatformAdmin())) return { error: "Acesso negado." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("households")
    .update({
      subscription_status: "active",
      suspended_reason: null,
      suspended_at: null,
    })
    .eq("id", householdId);
  if (error) return { error: error.message };

  await recordAdminAction({
    action: "household.unsuspend",
    targetHouseholdId: householdId,
  });
  revalidatePath("/admin/households");
  revalidatePath(`/admin/households/${householdId}`);
  return { ok: true };
}

// ============================================================================
// Delete household (hard delete — cascade) — LGPD direito de eliminação
// ============================================================================

export async function deleteHousehold(
  householdId: string,
  confirmationName: string,
): Promise<AdminActionResult> {
  if (!(await isPlatformAdmin())) return { error: "Acesso negado." };
  const admin = createAdminClient();

  // Sanity-check: pede pra digitar o nome do household pra confirmar
  const { data: h } = await admin
    .from("households")
    .select("name")
    .eq("id", householdId)
    .maybeSingle();
  if (!h) return { error: "Household não encontrado." };
  if (h.name !== confirmationName) {
    return { error: "Nome de confirmação não confere." };
  }

  // Log ANTES de apagar (depois admin_audit_log.target_household_id fica NULL)
  await recordAdminAction({
    action: "household.delete",
    targetHouseholdId: householdId,
    details: { household_name: h.name },
  });

  const { error } = await admin.from("households").delete().eq("id", householdId);
  if (error) return { error: error.message };

  revalidatePath("/admin/households");
  return { ok: true };
}

// ============================================================================
// User: deactivate / reactivate / delete (LGPD)
// ============================================================================

export async function deactivateUser(
  userId: string,
  reason: string,
): Promise<AdminActionResult> {
  if (!(await isPlatformAdmin())) return { error: "Acesso negado." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("users")
    .update({
      is_active: false,
      deactivated_at: new Date().toISOString(),
      deactivated_reason: reason,
    })
    .eq("id", userId);
  if (error) return { error: error.message };
  await recordAdminAction({
    action: "user.deactivate",
    targetUserId: userId,
    details: { reason },
  });
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}

export async function reactivateUser(
  userId: string,
): Promise<AdminActionResult> {
  if (!(await isPlatformAdmin())) return { error: "Acesso negado." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("users")
    .update({ is_active: true, deactivated_at: null, deactivated_reason: null })
    .eq("id", userId);
  if (error) return { error: error.message };
  await recordAdminAction({ action: "user.reactivate", targetUserId: userId });
  revalidatePath("/admin/users");
  return { ok: true };
}

// Hard delete via auth.users (cascade pra public.users + tudo via FK)
export async function deleteUser(
  userId: string,
  confirmationEmail: string,
): Promise<AdminActionResult> {
  if (!(await isPlatformAdmin())) return { error: "Acesso negado." };
  const admin = createAdminClient();

  const { data: authData } = await admin.auth.admin.getUserById(userId);
  if (!authData.user) return { error: "Usuário não encontrado." };
  if (authData.user.email !== confirmationEmail) {
    return { error: "Email de confirmação não confere." };
  }

  // Log ANTES
  await recordAdminAction({
    action: "user.delete",
    targetUserId: userId,
    details: { email: authData.user.email },
  });

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };

  revalidatePath("/admin/users");
  return { ok: true };
}

// ============================================================================
// Data Access Request handling (LGPD)
// ============================================================================

export async function handleDataRequest(
  requestId: string,
  action: "complete" | "reject",
  notes?: string,
): Promise<AdminActionResult> {
  if (!(await isPlatformAdmin())) return { error: "Acesso negado." };
  const admin = createAdminClient();
  const { data: ctx } = await admin
    .from("data_access_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (!ctx) return { error: "Solicitação não encontrada." };

  const { error } = await admin
    .from("data_access_requests")
    .update({
      status: action === "complete" ? "completed" : "rejected",
      completed_at: new Date().toISOString(),
      admin_notes: notes ?? null,
      // handled_by setado pelo log abaixo via auth.uid se possível
    })
    .eq("id", requestId);
  if (error) return { error: error.message };

  await recordAdminAction({
    action: `data_request.${action}`,
    targetUserId: ctx.user_id,
    details: { request_type: ctx.request_type, notes },
  });
  revalidatePath("/admin/data-requests");
  return { ok: true };
}

// ============================================================================
// Household: promote/demote member (multi-admin) — NÃO platform, é household
// ============================================================================
// (acionado pelo admin do household, não pelo platform admin)

import { getCurrentUserContext } from "@/services/auth";

export async function promoteHouseholdMember(
  targetUserId: string,
): Promise<AdminActionResult> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };
  if (ctx.profile.role !== "admin") {
    return { error: "Só admin do household pode promover membros." };
  }
  const admin = createAdminClient();
  const { data: target } = await admin
    .from("users")
    .select("household_id, role")
    .eq("id", targetUserId)
    .maybeSingle();
  if (!target) return { error: "Usuário não encontrado." };
  if (target.household_id !== ctx.household.id) {
    return { error: "Membro fora do seu household." };
  }
  if (target.role === "admin") return { ok: true }; // já é

  const { error } = await admin
    .from("users")
    .update({ role: "admin" })
    .eq("id", targetUserId);
  if (error) return { error: error.message };

  revalidatePath("/configuracoes");
  return { ok: true };
}

export async function demoteHouseholdMember(
  targetUserId: string,
): Promise<AdminActionResult> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };
  if (ctx.profile.role !== "admin") {
    return { error: "Só admin do household pode demover membros." };
  }
  const admin = createAdminClient();

  // Verifica que não é o owner (created_by) — owner não pode ser demovido
  const { data: household } = await admin
    .from("households")
    .select("created_by")
    .eq("id", ctx.household.id)
    .maybeSingle();
  if (household?.created_by === targetUserId) {
    return { error: "O criador do household não pode ser demovido." };
  }
  if (targetUserId === ctx.profile.id) {
    return { error: "Vc não pode se demover. Outro admin precisa fazer isso." };
  }

  const { error } = await admin
    .from("users")
    .update({ role: "member" })
    .eq("id", targetUserId);
  if (error) return { error: error.message };

  revalidatePath("/configuracoes");
  return { ok: true };
}

export async function removeHouseholdMember(
  targetUserId: string,
): Promise<AdminActionResult> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };
  if (ctx.profile.role !== "admin") {
    return { error: "Só admin do household pode remover membros." };
  }
  const admin = createAdminClient();

  const { data: household } = await admin
    .from("households")
    .select("created_by")
    .eq("id", ctx.household.id)
    .maybeSingle();
  if (household?.created_by === targetUserId) {
    return { error: "O criador do household não pode ser removido." };
  }
  if (targetUserId === ctx.profile.id) {
    return { error: "Vc não pode se remover. Use 'sair do household'." };
  }

  // Hard delete da relação (mantém auth.users intacto — pode estar em outros households no futuro)
  const { error } = await admin
    .from("users")
    .update({ is_active: false, deactivated_at: new Date().toISOString(), deactivated_reason: "removed by admin" })
    .eq("id", targetUserId);
  if (error) return { error: error.message };

  revalidatePath("/configuracoes");
  return { ok: true };
}

// Re-export pra evitar warning sobre `requirePlatformAdmin` não usado
export { requirePlatformAdmin };
