"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";

const upsertSchema = z.object({
  categoryId: z.string().uuid(),
  amount: z.coerce.number().nonnegative(),
  currency: z.enum(["BRL", "EUR", "USD"]).default("BRL"),
  alertThreshold: z.coerce.number().min(0).max(1).default(0.8),
  // YYYY-MM (mês a partir do qual vale). Default: mês corrente.
  startMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

export type BudgetActionState = { ok?: boolean; error?: string };

function currentMonthSP(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
}

/**
 * Cria ou atualiza o budget de uma categoria. Se já existe linha pra esse
 * (category, start_month), atualiza; senão cria nova. Pra mudar o limite
 * a partir do mês que vem, passe startMonth = "YYYY-MM" do mês que vem.
 */
export async function upsertBudget(input: {
  categoryId: string;
  amount: number;
  currency?: "BRL" | "EUR" | "USD";
  alertThreshold?: number;
  startMonth?: string;
}): Promise<BudgetActionState> {
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const startMonth = `${parsed.data.startMonth ?? currentMonthSP()}-01`;

  // Se amount = 0, considera como remoção (não faz sentido orçamento de zero)
  if (parsed.data.amount === 0) {
    const { error } = await supabase
      .from("category_budgets")
      .delete()
      .eq("household_id", ctx.household.id)
      .eq("category_id", parsed.data.categoryId)
      .eq("start_month", startMonth);
    if (error) return { error: error.message };
    revalidatePath("/categorias");
    revalidatePath("/dashboard");
    revalidatePath("/analise");
    return { ok: true };
  }

  const { error } = await supabase.from("category_budgets").upsert(
    {
      household_id: ctx.household.id,
      category_id: parsed.data.categoryId,
      start_month: startMonth,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      alert_threshold: parsed.data.alertThreshold,
    },
    { onConflict: "household_id,category_id,start_month" },
  );
  if (error) return { error: error.message };

  revalidatePath("/categorias");
  revalidatePath("/dashboard");
  revalidatePath("/analise");
  return { ok: true };
}

export async function deleteBudget(id: string): Promise<BudgetActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("category_budgets").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/categorias");
  revalidatePath("/dashboard");
  revalidatePath("/analise");
  return { ok: true };
}
