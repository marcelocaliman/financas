import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserContext } from "@/services/auth";
import type { Tables } from "@/types/database";

export type FeatureFlag = Tables<"feature_flags">;

/**
 * Lista TODAS as feature flags (admin only via createAdminClient).
 */
export async function listFeatureFlags(): Promise<FeatureFlag[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("feature_flags")
    .select("*")
    .order("key");
  if (error) throw error;
  return data ?? [];
}

/**
 * Verifica se uma feature está ligada PRO USUÁRIO CORRENTE.
 * Considera: enabled global, tier do household, rollout_pct.
 * Cached por request.
 */
export const isFeatureEnabled = cache(async (key: string): Promise<boolean> => {
  const ctx = await getCurrentUserContext();
  if (!ctx) return false;

  const supabase = await createClient();
  const { data: flag } = await supabase
    .from("feature_flags")
    .select("*")
    .eq("key", key)
    .maybeSingle();

  if (!flag || !flag.enabled) return false;

  // Tier gate: se enabled_for_tiers não vazio, household tem que ter o tier
  if (flag.enabled_for_tiers && flag.enabled_for_tiers.length > 0) {
    const { data: household } = await supabase
      .from("households")
      .select("subscription_tier")
      .eq("id", ctx.household.id)
      .maybeSingle();
    if (!household || !flag.enabled_for_tiers.includes(household.subscription_tier)) {
      return false;
    }
  }

  // Rollout gradual: hash do household_id mapeado pra [0,100)
  if (flag.rollout_pct < 100) {
    const hash = simpleHash(ctx.household.id + key) % 100;
    if (hash >= flag.rollout_pct) return false;
  }

  return true;
});

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}
