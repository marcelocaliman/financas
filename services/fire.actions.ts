"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";

const householdSchema = z.object({
  targetMonthlyIncome: z.coerce.number().nonnegative().optional(),
  expectedReturnPct: z.coerce.number().min(0).max(50),
  inflationPct: z.coerce.number().min(0).max(50),
  swrPct: z.coerce.number().min(0.1).max(20),
});

const userSchema = z.object({
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  targetRetirementAge: z.coerce.number().int().min(18).max(100).optional(),
  inssMonthlyEstimate: z.coerce.number().nonnegative().optional(),
});

export type SaveFireState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function parseErrors(e: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of e.issues) {
    const p = i.path.join(".");
    if (p && !out[p]) out[p] = i.message;
  }
  return out;
}

export async function saveFirePreferences(
  _prev: SaveFireState | undefined,
  formData: FormData,
): Promise<SaveFireState> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  // Só admin do household altera as prefs compartilhadas. Members alteram só
  // as próprias (birth_date, retirement_age, inss).
  const isAdmin = ctx.profile.role === "admin";

  const hParsed = householdSchema.safeParse({
    targetMonthlyIncome: formData.get("targetMonthlyIncome") || undefined,
    expectedReturnPct: formData.get("expectedReturnPct") || "6",
    inflationPct: formData.get("inflationPct") || "4",
    swrPct: formData.get("swrPct") || "4",
  });
  const uParsed = userSchema.safeParse({
    birthDate: formData.get("birthDate") || undefined,
    targetRetirementAge: formData.get("targetRetirementAge") || undefined,
    inssMonthlyEstimate: formData.get("inssMonthlyEstimate") || undefined,
  });

  if (!hParsed.success) return { fieldErrors: parseErrors(hParsed.error) };
  if (!uParsed.success) return { fieldErrors: parseErrors(uParsed.error) };

  const supabase = await createClient();

  if (isAdmin) {
    const { error } = await supabase
      .from("households")
      .update({
        fire_target_monthly_income: hParsed.data.targetMonthlyIncome ?? null,
        fire_expected_return_pct: hParsed.data.expectedReturnPct,
        fire_inflation_pct: hParsed.data.inflationPct,
        fire_swr_pct: hParsed.data.swrPct,
      })
      .eq("id", ctx.household.id);
    if (error) return { error: error.message };
  }

  const { error: uErr } = await supabase
    .from("users")
    .update({
      birth_date: uParsed.data.birthDate ?? null,
      target_retirement_age: uParsed.data.targetRetirementAge ?? null,
      inss_monthly_estimate: uParsed.data.inssMonthlyEstimate ?? null,
    })
    .eq("id", ctx.profile.id);
  if (uErr) return { error: uErr.message };

  revalidatePath("/independencia");
  revalidatePath("/configuracoes/fire");
  revalidatePath("/dashboard");
  return { ok: true };
}
