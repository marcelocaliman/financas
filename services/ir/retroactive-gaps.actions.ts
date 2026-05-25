"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";

/**
 * Cria N transações históricas IR pra preencher meses faltantes de uma
 * recorrência. Marca todas com is_historical_ir_only=true → não afetam saldo,
 * só aparecem em relatórios IR.
 */
const fillSchema = z.object({
  ruleId: z.string().uuid(),
  months: z.array(z.string().regex(/^\d{4}-\d{2}$/)).min(1),
  /** Dia do mês pra usar (default: day_of_month da regra, ou 1) */
  dayOfMonth: z.coerce.number().int().min(1).max(28).optional(),
});

export async function fillRetroactiveMonths(
  input: z.input<typeof fillSchema>,
): Promise<{ ok?: boolean; created?: number; error?: string }> {
  const parsed = fillSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { data: rule, error: rErr } = await supabase
    .from("recurring_rules")
    .select("*")
    .eq("id", parsed.data.ruleId)
    .maybeSingle();
  if (rErr || !rule) return { error: "Recorrência não encontrada." };
  if (rule.kind === "transfer") {
    return { error: "Transferências não podem ser históricas (movem dinheiro entre contas)." };
  }
  if (!rule.account_id) {
    return { error: "Recorrência sem conta destino — corrija antes." };
  }

  const dayOfMonth = parsed.data.dayOfMonth ?? rule.day_of_month ?? 1;

  // Constrói N transações
  const rows = parsed.data.months.map((m) => {
    const dateStr = `${m}-${String(dayOfMonth).padStart(2, "0")}`;
    return {
      household_id: ctx.household.id,
      account_id: rule.account_id as string,
      category_id: rule.category_id,
      kind: rule.kind,
      amount: rule.amount,
      amount_account: rule.amount,
      currency: rule.currency,
      description: rule.description,
      payment_method: rule.payment_method,
      date: dateStr,
      created_by: ctx.profile.id,
      category_source: "manual" as const,
      is_recurring: true,
      recurring_rule_id: parsed.data.ruleId,
      fonte_pagadora_id: rule.fonte_pagadora_id,
      irrf_amount: rule.irrf_amount,
      inss_amount: rule.inss_amount,
      exclude_from_ir: rule.exclude_from_ir,
      is_historical_ir_only: true, // ← chave: não afeta saldo
      metadata: { recurring: true, retroactive_fill: true },
    };
  });

  const { data, error } = await supabase
    .from("transactions")
    .insert(rows)
    .select("id");
  if (error) return { error: error.message };

  for (const p of ["/transacoes", "/dashboard", "/ir"]) revalidatePath(p);
  return { ok: true, created: data?.length ?? 0 };
}
