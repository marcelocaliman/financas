import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserContext } from "@/services/auth";
import type { Tables } from "@/types/database";

export type Announcement = Tables<"announcements">;

/**
 * Lista anúncios ATIVOS pra o usuário corrente (não vencidos, não dispensados,
 * compatíveis com seu tier).
 */
export const getActiveAnnouncementsForUser = cache(async (): Promise<Announcement[]> => {
  const ctx = await getCurrentUserContext();
  if (!ctx) return [];

  const supabase = await createClient();
  const now = new Date().toISOString();

  const [annsRes, householdRes, dismissalsRes] = await Promise.all([
    supabase
      .from("announcements")
      .select("*")
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
      .order("created_at", { ascending: false }),
    supabase
      .from("households")
      .select("subscription_tier")
      .eq("id", ctx.household.id)
      .maybeSingle(),
    supabase
      .from("announcement_dismissals")
      .select("announcement_id")
      .eq("user_id", ctx.profile.id),
  ]);

  const dismissed = new Set((dismissalsRes.data ?? []).map((d) => d.announcement_id));
  const tier = householdRes.data?.subscription_tier;

  return (annsRes.data ?? []).filter((a) => {
    if (dismissed.has(a.id)) return false;
    if (a.target_tier && a.target_tier !== tier) return false;
    return true;
  });
});

/**
 * Lista TODOS os anúncios (admin).
 */
export async function listAllAnnouncements(): Promise<Announcement[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
