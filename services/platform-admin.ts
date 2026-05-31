import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserContext } from "@/services/auth";
import type { Tables, Json } from "@/types/database";

/**
 * Verifica se o usuário corrente é platform admin.
 * Cached pra request — chamada várias vezes não bate no banco repetido.
 */
export const isPlatformAdmin = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  // Chama a SQL function is_platform_admin — RLS-safe
  const { data, error } = await supabase.rpc("is_platform_admin", {
    uid: user.id,
  });
  if (error) {
    console.error("isPlatformAdmin error:", error.message);
    return false;
  }
  return Boolean(data);
});

/**
 * Guard pra páginas/actions de admin. Redireciona pra /dashboard se não for.
 * Use no topo de qualquer page/action sob /admin.
 */
export async function requirePlatformAdmin(): Promise<void> {
  const ok = await isPlatformAdmin();
  if (!ok) redirect("/dashboard");
}

// ============================================================================
// Queries (todas usam admin client após guard)
// ============================================================================

export type HouseholdAdminRow = Tables<"households"> & {
  member_count: number;
  last_activity_at: string | null;
};

export async function listAllHouseholds(): Promise<HouseholdAdminRow[]> {
  await requirePlatformAdmin();
  const admin = createAdminClient();

  const { data: households, error } = await admin
    .from("households")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!households) return [];

  // Conta membros + última atividade (última transação) por household.
  // Em produção fazer via view ou RPC; aqui faz inline pra simplicidade.
  const ids = households.map((h) => h.id);
  const [membersRes, activityRes] = await Promise.all([
    admin
      .from("users")
      .select("household_id")
      .in("household_id", ids)
      .eq("is_active", true),
    admin
      .from("transactions")
      .select("household_id, created_at")
      .in("household_id", ids)
      .order("created_at", { ascending: false }),
  ]);

  const memberCountByHousehold = new Map<string, number>();
  for (const m of membersRes.data ?? []) {
    memberCountByHousehold.set(
      m.household_id,
      (memberCountByHousehold.get(m.household_id) ?? 0) + 1,
    );
  }
  const lastActivityByHousehold = new Map<string, string>();
  for (const t of activityRes.data ?? []) {
    if (!lastActivityByHousehold.has(t.household_id)) {
      lastActivityByHousehold.set(t.household_id, t.created_at);
    }
  }

  return households.map((h) => ({
    ...h,
    member_count: memberCountByHousehold.get(h.id) ?? 0,
    last_activity_at: lastActivityByHousehold.get(h.id) ?? null,
  }));
}

export async function getHouseholdById(id: string) {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("households")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listHouseholdMembers(householdId: string) {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export type UserAdminRow = Tables<"users"> & {
  email: string | null;
  last_sign_in_at: string | null;
  household_name: string | null;
  is_platform_admin: boolean;
};

export async function listAllUsers(): Promise<UserAdminRow[]> {
  await requirePlatformAdmin();
  const admin = createAdminClient();

  const [usersRes, authRes, householdsRes, adminsRes] = await Promise.all([
    admin.from("users").select("*").order("created_at", { ascending: false }),
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("households").select("id, name"),
    admin.from("platform_admins").select("user_id"),
  ]);

  const authById = new Map(
    (authRes.data?.users ?? []).map((u) => [u.id, u]),
  );
  const householdById = new Map(
    (householdsRes.data ?? []).map((h) => [h.id, h.name]),
  );
  const adminSet = new Set((adminsRes.data ?? []).map((a) => a.user_id));

  return (usersRes.data ?? []).map((u) => ({
    ...u,
    email: authById.get(u.id)?.email ?? null,
    last_sign_in_at: authById.get(u.id)?.last_sign_in_at ?? null,
    household_name: householdById.get(u.household_id) ?? null,
    is_platform_admin: adminSet.has(u.id),
  }));
}

export async function getUserById(id: string): Promise<UserAdminRow | null> {
  await requirePlatformAdmin();
  const admin = createAdminClient();

  const [userRes, authRes, adminRes] = await Promise.all([
    admin.from("users").select("*").eq("id", id).maybeSingle(),
    admin.auth.admin.getUserById(id),
    admin.from("platform_admins").select("user_id").eq("user_id", id).maybeSingle(),
  ]);

  if (!userRes.data) return null;
  const householdRes = await admin
    .from("households")
    .select("name")
    .eq("id", userRes.data.household_id)
    .maybeSingle();

  return {
    ...userRes.data,
    email: authRes.data.user?.email ?? null,
    last_sign_in_at: authRes.data.user?.last_sign_in_at ?? null,
    household_name: householdRes.data?.name ?? null,
    is_platform_admin: !!adminRes.data,
  };
}

// ============================================================================
// Platform stats (dashboard)
// ============================================================================

export type PlatformStats = {
  total_households: number;
  total_users: number;
  active_subscriptions: number;
  trialing: number;
  suspended: number;
  pending_data_requests: number;
  new_households_7d: number;
  new_users_7d: number;
};

export async function getPlatformStats(): Promise<PlatformStats> {
  await requirePlatformAdmin();
  // RPC com guard is_platform_admin() no banco → usa o client autenticado.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_platform_stats");
  if (error) throw error;
  const row = data?.[0];
  return (
    row ?? {
      total_households: 0,
      total_users: 0,
      active_subscriptions: 0,
      trialing: 0,
      suspended: 0,
      pending_data_requests: 0,
      new_households_7d: 0,
      new_users_7d: 0,
    }
  );
}

// ============================================================================
// Audit log
// ============================================================================

export type AuditLogRow = Tables<"admin_audit_log"> & {
  admin_email: string | null;
  target_household_name: string | null;
  target_user_email: string | null;
};

export async function listAuditLog(opts?: {
  limit?: number;
  adminUserId?: string;
  householdId?: string;
  action?: string;
}): Promise<AuditLogRow[]> {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  let q = admin
    .from("admin_audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 200);
  if (opts?.adminUserId) q = q.eq("admin_user_id", opts.adminUserId);
  if (opts?.householdId) q = q.eq("target_household_id", opts.householdId);
  if (opts?.action) q = q.eq("action", opts.action);

  const { data, error } = await q;
  if (error) throw error;
  if (!data) return [];

  // Enriquece com emails dos admins e nomes dos households envolvidos
  const adminIds = Array.from(new Set(data.map((r) => r.admin_user_id)));
  const targetUserIds = Array.from(
    new Set(data.map((r) => r.target_user_id).filter((id): id is string => !!id)),
  );
  const householdIds = Array.from(
    new Set(
      data.map((r) => r.target_household_id).filter((id): id is string => !!id),
    ),
  );

  const allUserIds = Array.from(new Set([...adminIds, ...targetUserIds]));
  const [authRes, householdsRes] = await Promise.all([
    allUserIds.length > 0
      ? admin.auth.admin.listUsers({ perPage: 1000 })
      : Promise.resolve({ data: { users: [] } }),
    householdIds.length > 0
      ? admin.from("households").select("id, name").in("id", householdIds)
      : Promise.resolve({ data: [] }),
  ]);

  const emailById = new Map(
    (authRes.data.users ?? []).map((u) => [u.id, u.email ?? null]),
  );
  const householdNameById = new Map(
    (householdsRes.data ?? []).map((h) => [h.id, h.name]),
  );

  return data.map((r) => ({
    ...r,
    admin_email: emailById.get(r.admin_user_id) ?? null,
    target_household_name: r.target_household_id
      ? householdNameById.get(r.target_household_id) ?? null
      : null,
    target_user_email: r.target_user_id
      ? emailById.get(r.target_user_id) ?? null
      : null,
  }));
}

// ============================================================================
// Helper: registra ação no audit log (chamado nas server actions admin)
// ============================================================================

export async function recordAdminAction(args: {
  action: string;
  targetHouseholdId?: string | null;
  targetUserId?: string | null;
  details?: Json;
}): Promise<void> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return; // sem user, sem log (não-fatal)

  const h = await headers();
  const ipAddress =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null;
  const userAgent = h.get("user-agent") ?? null;

  const admin = createAdminClient();
  await admin.from("admin_audit_log").insert({
    admin_user_id: ctx.profile.id,
    action: args.action,
    target_household_id: args.targetHouseholdId ?? null,
    target_user_id: args.targetUserId ?? null,
    details: args.details ?? null,
    ip_address: ipAddress,
    user_agent: userAgent,
  });
}

// ============================================================================
// Data requests (LGPD)
// ============================================================================

export async function listPendingDataRequests() {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("data_access_requests")
    .select("*")
    .neq("status", "completed")
    .neq("status", "rejected")
    .order("requested_at", { ascending: true });
  if (error) throw error;

  // Enrich with email
  const userIds = Array.from(new Set((data ?? []).map((r) => r.user_id)));
  let emailById = new Map<string, string | null>();
  if (userIds.length > 0) {
    const authRes = await admin.auth.admin.listUsers({ perPage: 1000 });
    emailById = new Map(
      (authRes.data.users ?? [])
        .filter((u) => userIds.includes(u.id))
        .map((u) => [u.id, u.email ?? null]),
    );
  }
  return (data ?? []).map((r) => ({
    ...r,
    user_email: emailById.get(r.user_id) ?? null,
  }));
}
