import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";

export type FirePreferences = {
  // Household-level
  targetMonthlyIncome: number | null;
  expectedReturnPct: number;
  inflationPct: number;
  swrPct: number;
  // User-level
  birthDate: string | null;
  targetRetirementAge: number | null;
  inssMonthlyEstimate: number | null;
};

const DEFAULTS = {
  expectedReturnPct: 6,
  inflationPct: 4,
  swrPct: 4,
};

/**
 * Lê preferências FIRE do household + user atual.
 * Defaults aplicados pra brasil quando NULL.
 */
export const getFirePreferences = cache(
  async (): Promise<FirePreferences | null> => {
    const ctx = await getCurrentUserContext();
    if (!ctx) return null;
    const supabase = await createClient();

    const [householdRes, userRes] = await Promise.all([
      supabase
        .from("households")
        .select(
          "fire_target_monthly_income, fire_expected_return_pct, fire_inflation_pct, fire_swr_pct",
        )
        .eq("id", ctx.household.id)
        .maybeSingle(),
      supabase
        .from("users")
        .select("birth_date, target_retirement_age, inss_monthly_estimate")
        .eq("id", ctx.profile.id)
        .maybeSingle(),
    ]);

    const h = householdRes.data;
    const u = userRes.data;
    return {
      targetMonthlyIncome:
        h?.fire_target_monthly_income != null
          ? Number(h.fire_target_monthly_income)
          : null,
      expectedReturnPct:
        h?.fire_expected_return_pct != null
          ? Number(h.fire_expected_return_pct)
          : DEFAULTS.expectedReturnPct,
      inflationPct:
        h?.fire_inflation_pct != null
          ? Number(h.fire_inflation_pct)
          : DEFAULTS.inflationPct,
      swrPct:
        h?.fire_swr_pct != null ? Number(h.fire_swr_pct) : DEFAULTS.swrPct,
      birthDate: u?.birth_date ?? null,
      targetRetirementAge: u?.target_retirement_age ?? null,
      inssMonthlyEstimate:
        u?.inss_monthly_estimate != null
          ? Number(u.inss_monthly_estimate)
          : null,
    };
  },
);
