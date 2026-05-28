"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  detectSubscriptions,
  type DetectedSubscription,
  type DetectionResult,
} from "@/services/ai/subscription-detector";
import { getCurrentUserContext } from "@/services/auth";
import { recordSystemAlert } from "@/services/system-alerts";

export type DetectSubscriptionsState =
  | { ok: true; result: DetectionResult; costCents: number }
  | { ok: false; error: string };

/**
 * Server action: roda IA pra detectar assinaturas zumbis nas transações do
 * usuário. Não cria nada — só retorna sugestões pra usuário confirmar.
 */
export async function runDetectSubscriptions(): Promise<DetectSubscriptionsState> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { ok: false, error: "Sessão expirada." };

  const res = await detectSubscriptions();
  if (!res.ok) {
    await recordSystemAlert({
      kind: "ai_subscription_detect_failed",
      severity: "warning",
      message: res.error,
      householdId: ctx.profile.household_id,
      context: { user_id: ctx.authId },
    });
    return { ok: false, error: res.error };
  }

  return { ok: true, result: res.result, costCents: res.usage.costCents };
}

const FREQ_MAP: Record<
  DetectedSubscription["frequency"],
  "monthly" | "weekly" | "yearly" | "daily"
> = {
  monthly: "monthly",
  weekly: "weekly",
  quarterly: "monthly", // cobrança trimestral fica como mensal × 3
  yearly: "yearly",
  irregular: "monthly",
};

/**
 * Confirma N detecções e cria recurring_rules com tag 'subscription'.
 * Skip duplicatas se já existir rule com mesma descrição+amount.
 */
export async function confirmDetectedSubscriptions(
  selected: DetectedSubscription[],
  defaultAccountId: string | null,
): Promise<{ ok: true; created: number; skipped: number } | { ok: false; error: string }> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { ok: false, error: "Sessão expirada." };
  if (selected.length === 0) return { ok: false, error: "Nenhuma assinatura selecionada." };

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  // Busca rules existentes pra não duplicar
  const { data: existing } = await supabase
    .from("recurring_rules")
    .select("description, amount")
    .eq("kind", "expense");

  const existingSet = new Set(
    (existing ?? []).map((e) => `${normalize(e.description)}|${Number(e.amount).toFixed(2)}`),
  );

  let created = 0;
  let skipped = 0;

  for (const sub of selected) {
    const key = `${normalize(sub.merchant_name)}|${sub.amount_average.toFixed(2)}`;
    if (existingSet.has(key)) {
      skipped++;
      continue;
    }

    const frequency = FREQ_MAP[sub.frequency];
    const intervalCount = sub.frequency === "quarterly" ? 3 : 1;

    const { error } = await supabase.from("recurring_rules").insert({
      household_id: ctx.profile.household_id,
      created_by: ctx.authId,
      kind: "expense",
      amount: sub.amount_average,
      currency: "BRL",
      description: sub.merchant_name,
      account_id: defaultAccountId,
      frequency,
      interval_count: intervalCount,
      day_of_month: frequency === "monthly" ? (sub.day_of_month ?? 1) : null,
      day_of_week: null,
      start_date: today,
      end_date: null,
      is_active: true,
      tags: ["subscription", "ai_detected"],
      notes: `Detectado por IA: ${sub.reasoning}`,
      exclude_from_ir: false,
      is_tax_deductible: false,
    });

    if (error) {
      skipped++;
      continue;
    }
    created++;
  }

  revalidatePath("/assinaturas");
  revalidatePath("/recorrentes");
  revalidatePath("/dashboard");

  return { ok: true, created, skipped };
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 30);
}
