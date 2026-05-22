"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";
import type { RecurrenceFrequency } from "@/types/database";

const KINDS = ["income", "expense", "transfer"] as const;
const CURRENCIES = ["BRL", "EUR", "USD"] as const;
const FREQUENCIES = ["daily", "weekly", "monthly", "yearly"] as const;
const PAYMENT_METHODS = ["credit", "debit", "pix", "cash", "auto_debit", "transfer"] as const;

const baseSchema = z.object({
  kind: z.enum(KINDS),
  amount: z.coerce.number().positive("Valor precisa ser positivo."),
  currency: z.enum(CURRENCIES).default("BRL"),
  description: z.string().min(1, "Descreva em poucas palavras."),
  accountId: z.string().uuid().optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional().nullable(),
  fromAccountId: z.string().uuid().optional().nullable(),
  toAccountId: z.string().uuid().optional().nullable(),
  frequency: z.enum(FREQUENCIES),
  intervalCount: z.coerce.number().int().min(1).max(365).default(1),
  dayOfMonth: z.coerce.number().int().min(1).max(31).optional().nullable(),
  dayOfWeek: z.coerce.number().int().min(0).max(6).optional().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes: z.string().optional().nullable(),
});

const updateSchema = baseSchema.extend({ id: z.string().uuid() });

export type RecurrenceFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function parseErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const p = issue.path.join(".");
    if (p && !out[p]) out[p] = issue.message;
  }
  return out;
}

function pathsToInvalidate() {
  return ["/recorrentes", "/transacoes", "/dashboard"];
}

function readForm(formData: FormData) {
  const get = (k: string) => {
    const v = formData.get(k);
    return v == null ? undefined : String(v);
  };
  return {
    kind: get("kind"),
    amount: get("amount"),
    currency: get("currency") || "BRL",
    description: get("description"),
    accountId: get("accountId") || undefined,
    categoryId: get("categoryId") || undefined,
    paymentMethod: get("paymentMethod") || undefined,
    fromAccountId: get("fromAccountId") || undefined,
    toAccountId: get("toAccountId") || undefined,
    frequency: get("frequency"),
    intervalCount: get("intervalCount") ?? 1,
    dayOfMonth: get("dayOfMonth") || undefined,
    dayOfWeek: get("dayOfWeek") || undefined,
    startDate: get("startDate"),
    endDate: get("endDate") || undefined,
    notes: get("notes") || undefined,
  };
}

function validateKindTargets(d: {
  kind: "income" | "expense" | "transfer";
  accountId?: string | null;
  fromAccountId?: string | null;
  toAccountId?: string | null;
}): string | null {
  if (d.kind === "transfer") {
    if (!d.fromAccountId) return "Origem é obrigatória.";
    if (!d.toAccountId) return "Destino é obrigatório.";
    if (d.fromAccountId === d.toAccountId) return "Origem e destino devem ser diferentes.";
  } else {
    if (!d.accountId) return "Conta é obrigatória.";
  }
  return null;
}

export async function createRecurringRule(
  _prev: RecurrenceFormState | undefined,
  formData: FormData,
): Promise<RecurrenceFormState> {
  const parsed = baseSchema.safeParse(readForm(formData));
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const err = validateKindTargets({
    kind: parsed.data.kind,
    accountId: parsed.data.accountId ?? null,
    fromAccountId: parsed.data.fromAccountId ?? null,
    toAccountId: parsed.data.toAccountId ?? null,
  });
  if (err) return { error: err };

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const isTransfer = parsed.data.kind === "transfer";
  const { error } = await supabase.from("recurring_rules").insert({
    household_id: ctx.household.id,
    kind: parsed.data.kind,
    amount: parsed.data.amount,
    currency: parsed.data.currency,
    description: parsed.data.description.trim(),
    account_id: isTransfer ? null : (parsed.data.accountId ?? null),
    category_id: isTransfer ? null : (parsed.data.categoryId ?? null),
    payment_method: isTransfer ? null : (parsed.data.paymentMethod ?? null),
    from_account_id: isTransfer ? parsed.data.fromAccountId : null,
    to_account_id: isTransfer ? parsed.data.toAccountId : null,
    frequency: parsed.data.frequency as RecurrenceFrequency,
    interval_count: parsed.data.intervalCount,
    day_of_month: parsed.data.dayOfMonth ?? null,
    day_of_week: parsed.data.dayOfWeek ?? null,
    start_date: parsed.data.startDate,
    end_date: parsed.data.endDate ?? null,
    notes: parsed.data.notes?.trim() ?? null,
    created_by: ctx.profile.id,
  });
  if (error) return { error: error.message };

  for (const p of pathsToInvalidate()) revalidatePath(p);
  return { ok: true };
}

export async function updateRecurringRule(
  _prev: RecurrenceFormState | undefined,
  formData: FormData,
): Promise<RecurrenceFormState> {
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    ...readForm(formData),
  });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const err = validateKindTargets({
    kind: parsed.data.kind,
    accountId: parsed.data.accountId ?? null,
    fromAccountId: parsed.data.fromAccountId ?? null,
    toAccountId: parsed.data.toAccountId ?? null,
  });
  if (err) return { error: err };

  const supabase = await createClient();
  const isTransfer = parsed.data.kind === "transfer";
  const { error } = await supabase
    .from("recurring_rules")
    .update({
      kind: parsed.data.kind,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      description: parsed.data.description.trim(),
      account_id: isTransfer ? null : (parsed.data.accountId ?? null),
      category_id: isTransfer ? null : (parsed.data.categoryId ?? null),
      payment_method: isTransfer ? null : (parsed.data.paymentMethod ?? null),
      from_account_id: isTransfer ? parsed.data.fromAccountId : null,
      to_account_id: isTransfer ? parsed.data.toAccountId : null,
      frequency: parsed.data.frequency as RecurrenceFrequency,
      interval_count: parsed.data.intervalCount,
      day_of_month: parsed.data.dayOfMonth ?? null,
      day_of_week: parsed.data.dayOfWeek ?? null,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate ?? null,
      notes: parsed.data.notes?.trim() ?? null,
    })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  for (const p of pathsToInvalidate()) revalidatePath(p);
  return { ok: true };
}

export async function setRecurringRuleActive(
  id: string,
  active: boolean,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("recurring_rules")
    .update({ is_active: active })
    .eq("id", id);
  if (error) return { error: error.message };
  for (const p of pathsToInvalidate()) revalidatePath(p);
  return { ok: true };
}

/**
 * Deleta a regra. Por padrão deleta também as instâncias FUTURAS já materializadas
 * (transactions com recurring_rule_id = id e date > hoje). Histórico passado fica.
 */
export async function deleteRecurringRule(
  id: string,
  opts: { deleteFutureInstances?: boolean } = {},
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const todayISO = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  if (opts.deleteFutureInstances ?? true) {
    const { error: delErr } = await supabase
      .from("transactions")
      .delete()
      .eq("recurring_rule_id", id)
      .gt("date", todayISO);
    if (delErr) return { error: delErr.message };
  }

  const { error } = await supabase.from("recurring_rules").delete().eq("id", id);
  if (error) return { error: error.message };
  for (const p of pathsToInvalidate()) revalidatePath(p);
  return { ok: true };
}

/**
 * Força materializar uma regra (ou todas, se id omitido) até `untilDate`.
 * Default: hoje. Use pra antecipar gerações sem esperar o cron diário.
 */
export async function materializeRecurrenceNow(
  ruleId?: string,
  untilDate?: string,
): Promise<{ ok?: boolean; created?: number; error?: string }> {
  const supabase = await createClient();
  const target =
    untilDate ??
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

  if (ruleId) {
    const { data, error } = await supabase.rpc("materialize_recurrence", {
      p_rule_id: ruleId,
      p_until_date: target,
    });
    if (error) return { error: error.message };
    for (const p of pathsToInvalidate()) revalidatePath(p);
    return { ok: true, created: data ?? 0 };
  }

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const { data, error } = await supabase.rpc("materialize_all_recurrences", {
    p_household_id: ctx.household.id,
    p_until_date: target,
  });
  if (error) return { error: error.message };
  for (const p of pathsToInvalidate()) revalidatePath(p);
  return { ok: true, created: data ?? 0 };
}
