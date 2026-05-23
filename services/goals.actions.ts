"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";
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
  const rows = sources.map((s) => ({
    goal_id: goalId,
    source_type: s.sourceType,
    source_id: s.sourceType === "manual" ? null : s.sourceId ?? null,
    allocated_amount: s.allocatedAmount ?? null,
    allocated_pct: s.allocatedPct ?? null,
    notes: s.notes ?? null,
  }));
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
 *  - source: 'manual' por padrão
 *  - bumpCurrent=true: também soma no current_amount (snapshot)
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
  },
): Promise<{ ok?: boolean; error?: string }> {
  if (amount <= 0) return { error: "Valor deve ser positivo." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_goal_contribution", {
    p_goal_id: goalId,
    p_amount: amount,
    p_date: opts?.date ?? new Date().toISOString().slice(0, 10),
    p_source: opts?.source ?? "manual",
    p_notes: opts?.notes ?? null,
    p_transaction_id: opts?.transactionId ?? null,
    p_bump_current: opts?.bumpCurrent ?? true,
  });
  if (error) return { error: error.message };
  revalidatePath("/metas");
  revalidatePath("/dashboard");
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
