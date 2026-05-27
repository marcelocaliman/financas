"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";
import { listGoalsEnriched } from "@/services/goals";
import type { GoalSourceType } from "@/types/database";

const GOAL_TYPES = [
  "emergencia",
  "casa",
  "veiculo",
  "viagem",
  "aposentadoria",
  "educacao",
  "projeto",
  "outro",
] as const;
const ALLOCATION_MODES = ["manual", "fixed_amount", "percentage", "waterfall"] as const;

const sourceSchema = z.object({
  sourceType: z.enum(["account", "investment", "manual"]) as z.ZodType<GoalSourceType>,
  sourceId: z.string().uuid().optional(),
  allocatedAmount: z.coerce.number().nonnegative().optional(),
  allocatedPct: z.coerce.number().min(0).max(1).optional(),
  notes: z.string().optional(),
});

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  targetAmount: z.coerce.number().positive(),
  currentAmount: z.coerce.number().nonnegative().default(0),
  currency: z.enum(["BRL", "EUR", "USD"]).default("BRL"),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  linkedAccountId: z.string().uuid().optional(),
  goalType: z.enum(GOAL_TYPES).default("outro"),
  priority: z.coerce.number().int().nonnegative().default(100),
  allocationMode: z.enum(ALLOCATION_MODES).default("manual"),
  allocationValue: z.coerce.number().nonnegative().optional(),
  contributionDay: z.coerce.number().int().min(1).max(31).optional(),
  trackingStartsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // Financiamento (todas opcionais — preenchidas só quando is goal de imóvel financiado)
  propertyPrice: z.coerce.number().positive().optional(),
  propertyDownPct: z.coerce.number().min(0).max(1).optional(),
  propertyClosingPct: z.coerce.number().min(0).max(1).optional(),
  loanTermMonths: z.coerce.number().int().min(1).max(600).optional(),
  loanAnnualRatePct: z.coerce.number().min(0).max(100).optional(),
  loanSystem: z.enum(["sac", "price"]).optional(),
  // Sources passados como JSON serializado
  sourcesJson: z.string().optional(),
});

const updateSchema = createSchema.extend({ id: z.string().uuid() });

export type GoalFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function parseErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of error.issues) {
    const p = i.path.join(".");
    if (p && !out[p]) out[p] = i.message;
  }
  return out;
}

function parseSources(json: string | undefined): z.infer<typeof sourceSchema>[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr.map((s) => sourceSchema.parse(s));
  } catch {
    return [];
  }
}

async function replaceSources(
  supabase: Awaited<ReturnType<typeof createClient>>,
  goalId: string,
  sources: z.infer<typeof sourceSchema>[],
): Promise<{ error?: string }> {
  // Estratégia simples: deleta tudo e recria. Goal_sources não tem FKs entrantes
  // (só goal_contributions referencia goals, não sources), seguro.
  await supabase.from("goal_sources").delete().eq("goal_id", goalId);
  if (sources.length === 0) return {};
  const rows = sources.map((s) => {
    // CHECK constraint exige allocated_amount OR allocated_pct preenchido.
    // Se o cliente esqueceu ambos, aplica fallback sensato:
    //   account/investment → 100% do saldo da fonte
    //   manual → R$ 0
    let allocatedAmount = s.allocatedAmount ?? null;
    let allocatedPct = s.allocatedPct ?? null;
    if (allocatedAmount == null && allocatedPct == null) {
      if (s.sourceType === "manual") {
        allocatedAmount = 0;
      } else {
        allocatedPct = 1;
      }
    }
    return {
      goal_id: goalId,
      source_type: s.sourceType,
      source_id: s.sourceType === "manual" ? null : s.sourceId ?? null,
      allocated_amount: allocatedAmount,
      allocated_pct: allocatedPct,
      notes: s.notes ?? null,
    };
  });
  const { error } = await supabase.from("goal_sources").insert(rows);
  if (error) return { error: error.message };
  return {};
}

export async function createGoal(
  _prev: GoalFormState | undefined,
  formData: FormData,
): Promise<GoalFormState> {
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    targetAmount: formData.get("targetAmount"),
    currentAmount: formData.get("currentAmount") ?? 0,
    currency: formData.get("currency") || "BRL",
    targetDate: formData.get("targetDate") || undefined,
    linkedAccountId: formData.get("linkedAccountId") || undefined,
    goalType: formData.get("goalType") || "outro",
    priority: formData.get("priority") ?? 100,
    allocationMode: formData.get("allocationMode") || "manual",
    allocationValue: formData.get("allocationValue") || undefined,
    contributionDay: formData.get("contributionDay") || undefined,
    trackingStartsAt: formData.get("trackingStartsAt") || undefined,
    propertyPrice: formData.get("propertyPrice") || undefined,
    propertyDownPct: formData.get("propertyDownPct") || undefined,
    propertyClosingPct: formData.get("propertyClosingPct") || undefined,
    loanTermMonths: formData.get("loanTermMonths") || undefined,
    loanAnnualRatePct: formData.get("loanAnnualRatePct") || undefined,
    loanSystem: formData.get("loanSystem") || undefined,
    sourcesJson: formData.get("sourcesJson")?.toString() || undefined,
  });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("goals")
    .insert({
      household_id: ctx.household.id,
      name: parsed.data.name.trim(),
      description: parsed.data.description?.trim() ?? null,
      target_amount: parsed.data.targetAmount,
      current_amount: parsed.data.currentAmount,
      currency: parsed.data.currency,
      target_date: parsed.data.targetDate ?? null,
      linked_account_id: parsed.data.linkedAccountId ?? null,
      goal_type: parsed.data.goalType,
      priority: parsed.data.priority,
      allocation_mode: parsed.data.allocationMode,
      allocation_value: parsed.data.allocationValue ?? null,
      contribution_day: parsed.data.contributionDay ?? null,
      tracking_starts_at: parsed.data.trackingStartsAt ?? null,
      property_price: parsed.data.propertyPrice ?? null,
      property_down_pct: parsed.data.propertyDownPct ?? null,
      property_closing_pct: parsed.data.propertyClosingPct ?? null,
      loan_term_months: parsed.data.loanTermMonths ?? null,
      loan_annual_rate_pct: parsed.data.loanAnnualRatePct ?? null,
      loan_system: parsed.data.loanSystem ?? null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const sources = parseSources(parsed.data.sourcesJson);
  if (sources.length > 0 && created) {
    const r = await replaceSources(supabase, created.id, sources);
    if (r.error) return { error: r.error };
  }

  revalidatePath("/metas");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateGoal(
  _prev: GoalFormState | undefined,
  formData: FormData,
): Promise<GoalFormState> {
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    targetAmount: formData.get("targetAmount"),
    currentAmount: formData.get("currentAmount") ?? 0,
    currency: formData.get("currency") || "BRL",
    targetDate: formData.get("targetDate") || undefined,
    linkedAccountId: formData.get("linkedAccountId") || undefined,
    goalType: formData.get("goalType") || "outro",
    priority: formData.get("priority") ?? 100,
    allocationMode: formData.get("allocationMode") || "manual",
    allocationValue: formData.get("allocationValue") || undefined,
    contributionDay: formData.get("contributionDay") || undefined,
    trackingStartsAt: formData.get("trackingStartsAt") || undefined,
    propertyPrice: formData.get("propertyPrice") || undefined,
    propertyDownPct: formData.get("propertyDownPct") || undefined,
    propertyClosingPct: formData.get("propertyClosingPct") || undefined,
    loanTermMonths: formData.get("loanTermMonths") || undefined,
    loanAnnualRatePct: formData.get("loanAnnualRatePct") || undefined,
    loanSystem: formData.get("loanSystem") || undefined,
    sourcesJson: formData.get("sourcesJson")?.toString() || undefined,
  });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update({
      name: parsed.data.name.trim(),
      description: parsed.data.description?.trim() ?? null,
      target_amount: parsed.data.targetAmount,
      current_amount: parsed.data.currentAmount,
      currency: parsed.data.currency,
      target_date: parsed.data.targetDate ?? null,
      linked_account_id: parsed.data.linkedAccountId ?? null,
      goal_type: parsed.data.goalType,
      priority: parsed.data.priority,
      allocation_mode: parsed.data.allocationMode,
      allocation_value: parsed.data.allocationValue ?? null,
      contribution_day: parsed.data.contributionDay ?? null,
      tracking_starts_at: parsed.data.trackingStartsAt ?? null,
      property_price: parsed.data.propertyPrice ?? null,
      property_down_pct: parsed.data.propertyDownPct ?? null,
      property_closing_pct: parsed.data.propertyClosingPct ?? null,
      loan_term_months: parsed.data.loanTermMonths ?? null,
      loan_annual_rate_pct: parsed.data.loanAnnualRatePct ?? null,
      loan_system: parsed.data.loanSystem ?? null,
    })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  const sources = parseSources(parsed.data.sourcesJson);
  const r = await replaceSources(supabase, parsed.data.id, sources);
  if (r.error) return { error: r.error };

  revalidatePath("/metas");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function archiveGoal(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update({ is_archived: true })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/metas");
  return { ok: true };
}

export async function restoreGoal(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update({ is_archived: false })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/metas");
  return { ok: true };
}

export async function deleteGoal(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/metas");
  return { ok: true };
}

/**
 * Registra um aporte numa meta. Chamado pelo botão "Aportar" no card.
 *
 * Três modos:
 *  1. Simbólico (sem fromAccountId): só registra histórico + bump current_amount.
 *     Pra metas sem fonte vinculada.
 *  2. Transferência real (from + to): cria duas transações espelhadas via
 *     create_transfer RPC (saída da conta origem, entrada na destino — que é
 *     uma fonte do tipo 'account' da meta). O current_amount NÃO é bumpado,
 *     pq o earmark live já reflete pelo saldo da conta destino. Linka a
 *     contribuição à transação 'in' pra rastreabilidade.
 *  3. Despesa (só fromAccountId): N/A por enquanto — fallback simbólico.
 */
export async function recordGoalContribution(
  goalId: string,
  amount: number,
  opts?: {
    date?: string;
    source?: string;
    notes?: string;
    transactionId?: string;
    bumpCurrent?: boolean;
    fromAccountId?: string;
    toAccountId?: string;
  },
): Promise<{ ok?: boolean; error?: string }> {
  if (amount <= 0) return { error: "Valor deve ser positivo." };
  const supabase = await createClient();

  const date = opts?.date ?? new Date().toISOString().slice(0, 10);
  let transactionId = opts?.transactionId ?? null;
  let bumpCurrent = opts?.bumpCurrent ?? true;
  let sourceLabel = opts?.source ?? "manual";

  // Modo transferência: from + to definidos e diferentes
  if (opts?.fromAccountId && opts?.toAccountId && opts.fromAccountId !== opts.toAccountId) {
    const { data: pairId, error: tErr } = await supabase.rpc("create_transfer", {
      p_from_account_id: opts.fromAccountId,
      p_to_account_id: opts.toAccountId,
      p_amount: amount,
      p_date: date,
      p_description: opts.notes?.trim() || "Aporte em meta",
    });
    if (tErr) return { error: tErr.message };

    // Linka a contribuição à perna 'in' (entrada na conta destino vinculada)
    if (pairId) {
      const { data: txIn } = await supabase
        .from("transactions")
        .select("id")
        .eq("transfer_pair_id", pairId)
        .eq("transfer_direction", "in")
        .maybeSingle();
      if (txIn?.id) transactionId = txIn.id;
    }
    // Não bumpa current_amount: o earmark da fonte já sobe pelo saldo
    bumpCurrent = false;
    sourceLabel = "transfer";
  } else if (opts?.fromAccountId && !opts?.toAccountId) {
    return { error: "Conta de destino obrigatória pra transferir." };
  }

  const { error } = await supabase.rpc("record_goal_contribution", {
    p_goal_id: goalId,
    p_amount: amount,
    p_date: date,
    p_source: sourceLabel,
    p_notes: opts?.notes ?? null,
    p_transaction_id: transactionId,
    p_bump_current: bumpCurrent,
  });
  if (error) return { error: error.message };
  revalidatePath("/metas");
  revalidatePath("/dashboard");
  revalidatePath("/contas");
  revalidatePath("/transacoes");
  return { ok: true };
}

/**
 * Retira (saca) dinheiro de uma meta — operação simétrica ao aporte.
 *
 * Modos:
 *  1. Simbólico (sem fromAccountId): decrementa current_amount + grava
 *     contribuição com valor NEGATIVO no histórico. Pra metas sem fonte
 *     vinculada.
 *  2. Transferência real (from + to): cria transferência via create_transfer
 *     da conta vinculada (fonte da meta) → conta destino escolhida pelo
 *     usuário. O earmark cai naturalmente pelo saldo da fonte. Linka à
 *     transação 'out' pra rastrear.
 *
 * Validações:
 *  - amount > 0 (UI passa o valor absoluto)
 *  - amount ≤ derivedCurrent (não permite saldo negativo na meta)
 *  - se transferência: fromAccountId ≠ toAccountId
 */
export async function recordGoalWithdrawal(
  goalId: string,
  amount: number,
  opts?: {
    date?: string;
    notes?: string;
    fromAccountId?: string;
    toAccountId?: string;
  },
): Promise<{ ok?: boolean; error?: string }> {
  if (amount <= 0) return { error: "Valor deve ser positivo." };

  // Defesa server-side: nunca permite retirar mais do que a meta tem
  const enriched = await listGoalsEnriched({ includeArchived: true });
  const goal = enriched.find((g) => g.id === goalId);
  if (!goal) return { error: "Meta não encontrada." };
  if (amount > goal.derivedCurrent + 0.005) {
    return {
      error: `Valor maior que o saldo da meta (${goal.derivedCurrent.toFixed(2)}).`,
    };
  }

  const supabase = await createClient();
  const date = opts?.date ?? new Date().toISOString().slice(0, 10);
  let transactionId: string | null = null;
  let bumpCurrent = true;
  let sourceLabel = "manual";

  // Modo transferência: from = fonte vinculada da meta, to = conta escolhida
  if (opts?.fromAccountId && opts?.toAccountId && opts.fromAccountId !== opts.toAccountId) {
    const { data: pairId, error: tErr } = await supabase.rpc("create_transfer", {
      p_from_account_id: opts.fromAccountId,
      p_to_account_id: opts.toAccountId,
      p_amount: amount,
      p_date: date,
      p_description: opts.notes?.trim() || "Retirada de meta",
    });
    if (tErr) return { error: tErr.message };

    if (pairId) {
      const { data: txOut } = await supabase
        .from("transactions")
        .select("id")
        .eq("transfer_pair_id", pairId)
        .eq("transfer_direction", "out")
        .maybeSingle();
      if (txOut?.id) transactionId = txOut.id;
    }
    // Earmark já cai pelo saldo da conta — não decrementa current_amount
    bumpCurrent = false;
    sourceLabel = "transfer";
  } else if (opts?.fromAccountId && !opts?.toAccountId) {
    return { error: "Conta de destino obrigatória pra transferir." };
  }

  // Registra como contribuição NEGATIVA
  const { error } = await supabase.rpc("record_goal_contribution", {
    p_goal_id: goalId,
    p_amount: -amount,
    p_date: date,
    p_source: sourceLabel,
    p_notes: opts?.notes ?? null,
    p_transaction_id: transactionId,
    p_bump_current: bumpCurrent,
  });
  if (error) return { error: error.message };

  revalidatePath("/metas");
  revalidatePath("/dashboard");
  revalidatePath("/contas");
  revalidatePath("/transacoes");
  return { ok: true };
}

/**
 * Reordena as metas em lote — usado pelo drag-and-drop.
 */
export async function reorderGoals(ids: string[]): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_goals", { p_ids: ids });
  if (error) return { error: error.message };
  revalidatePath("/metas");
  return { ok: true };
}

/**
 * Dispensa uma sugestão de aporte detectada (banner no dashboard).
 * Persiste em aport_suggestion_dismissals pra não reaparecer.
 */
export async function dismissAportSuggestion(
  transactionId: string,
  goalId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Auth required" };

  const supabase = await createClient();
  // Cast: tabela aport_suggestion_dismissals criada via migration 20260527020000
  const { error } = await (supabase as unknown as {
    from: (t: string) => {
      upsert: (
        data: object,
        options: { onConflict: string },
      ) => Promise<{ error: { message: string } | null }>;
    };
  })
    .from("aport_suggestion_dismissals")
    .upsert(
      {
        household_id: ctx.household.id,
        transaction_id: transactionId,
        goal_id: goalId,
        dismissed_by: ctx.authId,
      },
      { onConflict: "household_id,transaction_id,goal_id" },
    );
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}
