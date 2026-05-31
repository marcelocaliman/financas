import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/services/platform-admin";

export type SeriesPoint = { date: string; count: number };

// As RPCs admin_* têm guard is_platform_admin() no banco (defense-in-depth).
// Por isso usamos o client AUTENTICADO (não service-role) — pra auth.uid()
// resolver o guard. O requirePlatformAdmin() em TS continua como 1ª barreira.

export async function getHouseholdGrowth(days = 30): Promise<SeriesPoint[]> {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_household_growth", { p_days: days });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    date: typeof r.date === "string" ? r.date : String(r.date),
    count: Number(r.count),
  }));
}

export async function getUserGrowth(days = 30): Promise<SeriesPoint[]> {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_user_growth", { p_days: days });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    date: typeof r.date === "string" ? r.date : String(r.date),
    count: Number(r.count),
  }));
}

export async function getActionVolume(days = 30): Promise<SeriesPoint[]> {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_action_volume", { p_days: days });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    date: typeof r.date === "string" ? r.date : String(r.date),
    count: Number(r.count),
  }));
}

/**
 * DAU/WAU/MAU baseado em last_sign_in_at dos auth.users.
 */
export type DAUWAUMAU = {
  dau: number;
  wau: number;
  mau: number;
  stickiness: number; // DAU/MAU
};

export async function getDAUWAUMAU(): Promise<DAUWAUMAU> {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const users = data.users ?? [];

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  let dau = 0;
  let wau = 0;
  let mau = 0;

  for (const u of users) {
    if (!u.last_sign_in_at) continue;
    const t = new Date(u.last_sign_in_at).getTime();
    const ageMs = now - t;
    if (ageMs <= day) dau += 1;
    if (ageMs <= 7 * day) wau += 1;
    if (ageMs <= 30 * day) mau += 1;
  }

  return {
    dau,
    wau,
    mau,
    stickiness: mau > 0 ? dau / mau : 0,
  };
}

/**
 * Distribuição de subscription por tier — pra pie chart.
 */
export async function getTierDistribution(): Promise<
  { tier: string; count: number }[]
> {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from("households")
    .select("subscription_tier");
  const counts = new Map<string, number>();
  for (const h of data ?? []) {
    counts.set(h.subscription_tier, (counts.get(h.subscription_tier) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([tier, count]) => ({ tier, count }));
}

/**
 * Distribuição de subscription_status — pra pie chart.
 */
export async function getStatusDistribution(): Promise<
  { status: string; count: number }[]
> {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from("households")
    .select("subscription_status");
  const counts = new Map<string, number>();
  for (const h of data ?? []) {
    counts.set(h.subscription_status, (counts.get(h.subscription_status) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([status, count]) => ({ status, count }));
}

/**
 * Top admins por número de ações nos últimos 30d.
 */
export async function getTopAdminActions(days = 30): Promise<
  { admin_email: string | null; action_count: number }[]
> {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data: logs } = await admin
    .from("admin_audit_log")
    .select("admin_user_id")
    .gte("created_at", since);

  const counts = new Map<string, number>();
  for (const l of logs ?? []) {
    counts.set(l.admin_user_id, (counts.get(l.admin_user_id) ?? 0) + 1);
  }

  const authData = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map(
    (authData.data.users ?? []).map((u) => [u.id, u.email ?? null]),
  );

  return Array.from(counts.entries())
    .map(([uid, count]) => ({
      admin_email: emailById.get(uid) ?? null,
      action_count: count,
    }))
    .sort((a, b) => b.action_count - a.action_count)
    .slice(0, 10);
}

/**
 * Crescimento cumulativo (linha sempre subindo) — útil pra ver total ao longo do tempo.
 */
export function toCumulative(series: SeriesPoint[]): SeriesPoint[] {
  let total = 0;
  return series.map((p) => {
    total += p.count;
    return { date: p.date, count: total };
  });
}
