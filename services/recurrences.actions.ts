"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";
import type { RecurrenceFrequency, IRDeductibleKind } from "@/types/database";

const KINDS = ["income", "expense", "transfer"] as const;
const CURRENCIES = ["BRL", "EUR", "USD", "GBP"] as const;
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
  isSubscription: z.coerce.boolean().optional(),
  irDeductibleKind: z.string().optional().nullable(),
  isTaxDeductible: z.coerce.boolean().optional(),
  // Atribuição IRPF (salário/aluguel recorrente → fonte pagadora + retenções)
  fontePagadoraId: z.string().uuid().optional().nullable(),
  irrfAmount: z.coerce.number().nonnegative().optional().nullable(),
  inssAmount: z.coerce.number().nonnegative().optional().nullable(),
  deductibleAmount: z.coerce.number().nonnegative().optional().nullable(),
  // "Não declarar no IRPF" — herda pras transactions materializadas
  excludeFromIr: z.coerce.boolean().optional(),
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
    isSubscription: get("isSubscription") === "1" || get("isSubscription") === "true",
    irDeductibleKind: get("irDeductibleKind") || undefined,
    isTaxDeductible: get("isTaxDeductible") === "1" || get("isTaxDeductible") === "true",
    fontePagadoraId: get("fontePagadoraId") || undefined,
    irrfAmount: get("irrfAmount") || undefined,
    inssAmount: get("inssAmount") || undefined,
    deductibleAmount: get("deductibleAmount") || undefined,
    excludeFromIr: get("excludeFromIr") === "1" || get("excludeFromIr") === "true",
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

function validateDateRange(startDate: string, endDate: string | null | undefined): string | null {
  if (!endDate) return null;
  if (endDate < startDate) {
    return `A data de fim (${endDate}) é anterior à data de início (${startDate}). Ajuste o início pra uma data mais antiga ou mude o fim.`;
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

  const dateErr = validateDateRange(parsed.data.startDate, parsed.data.endDate);
  if (dateErr) return { error: dateErr };

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
    tags: parsed.data.isSubscription ? ["subscription"] : [],
    ir_deductible_kind: (parsed.data.irDeductibleKind ?? null) as IRDeductibleKind | null,
    is_tax_deductible: parsed.data.isTaxDeductible ?? false,
    fonte_pagadora_id: parsed.data.fontePagadoraId ?? null,
    irrf_amount: parsed.data.irrfAmount ?? null,
    inss_amount: parsed.data.inssAmount ?? null,
    deductible_amount:
      parsed.data.isTaxDeductible && parsed.data.deductibleAmount && parsed.data.deductibleAmount > 0
        ? parsed.data.deductibleAmount
        : null,
    exclude_from_ir: parsed.data.excludeFromIr ?? false,
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

  const dateErr = validateDateRange(parsed.data.startDate, parsed.data.endDate);
  if (dateErr) return { error: dateErr };

  const supabase = await createClient();
  const isTransfer = parsed.data.kind === "transfer";

  // Preserva outras tags (não-subscription) e adiciona/remove apenas 'subscription'
  // conforme o checkbox. Pra rule nova (sem fetch prévio), o default vem do trigger.
  const { data: current } = await supabase
    .from("recurring_rules")
    .select("tags")
    .eq("id", parsed.data.id)
    .maybeSingle();
  const existingTags = (current?.tags ?? []) as string[];
  const otherTags = existingTags.filter((t) => t !== "subscription");
  const newTags = parsed.data.isSubscription ? [...otherTags, "subscription"] : otherTags;

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
      tags: newTags,
      ir_deductible_kind: (parsed.data.irDeductibleKind ?? null) as IRDeductibleKind | null,
      is_tax_deductible: parsed.data.isTaxDeductible ?? false,
      fonte_pagadora_id: parsed.data.fontePagadoraId ?? null,
      irrf_amount: parsed.data.irrfAmount ?? null,
      inss_amount: parsed.data.inssAmount ?? null,
      deductible_amount:
        parsed.data.isTaxDeductible && parsed.data.deductibleAmount && parsed.data.deductibleAmount > 0
          ? parsed.data.deductibleAmount
          : null,
      exclude_from_ir: parsed.data.excludeFromIr ?? false,
    })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  // Backfill: propaga campos de IR pras transactions já materializadas dessa
  // regra. Sem isso, o usuário editaria a fonte do salário mas todos os
  // lançamentos anteriores continuariam sem fonte — e o checklist do IR
  // continuaria reclamando indefinidamente.
  if (!isTransfer) {
    // Campos ESTRUTURAIS (fonte, exclude_from_ir): propaga a todos os
    // lançamentos da regra — é o que faz o checklist do IR parar de reclamar.
    await supabase
      .from("transactions")
      .update({
        fonte_pagadora_id: parsed.data.fontePagadoraId ?? null,
        exclude_from_ir: parsed.data.excludeFromIr ?? false,
      } as never)
      .eq("recurring_rule_id", parsed.data.id);

    // IRRF/INSS variam por mês e a UI permite override por lançamento. Só
    // sobrescreve nos lançamentos FUTUROS (date >= hoje) pra não achatar as
    // retenções manuais de meses passados.
    const todaySP = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    await supabase
      .from("transactions")
      .update({
        irrf_amount: parsed.data.irrfAmount ?? null,
        inss_amount: parsed.data.inssAmount ?? null,
      } as never)
      .eq("recurring_rule_id", parsed.data.id)
      .gte("date", todaySP);
  }

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
 * Pausa/reativa várias regras de uma vez. Usado em ações em lote no header
 * de cada seção (ex: "Pausar todas as despesas" durante uma viagem).
 */
export async function setRecurringRulesActiveBatch(
  ids: string[],
  active: boolean,
): Promise<{ ok?: boolean; updated?: number; error?: string }> {
  if (ids.length === 0) return { ok: true, updated: 0 };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurring_rules")
    .update({ is_active: active })
    .in("id", ids)
    .select("id");
  if (error) return { error: error.message };
  for (const p of pathsToInvalidate()) revalidatePath(p);
  return { ok: true, updated: data?.length ?? 0 };
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
 * Cria várias regras de uma vez. Cada item segue o mesmo schema que `create`.
 * Roda inserts em batch; se UMA linha quebrar, aborta tudo (transação implícita
 * do PostgREST). Retorna quantas criadas + erros por linha.
 */
const batchItemSchema = baseSchema.extend({
  // dão pra usar os mesmos campos do baseSchema
});

export async function createRecurringRulesBatch(
  items: Array<Record<string, unknown>>,
): Promise<{ ok?: boolean; created?: number; errors?: Array<{ index: number; error: string }> }> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { errors: [{ index: -1, error: "Sessão expirada." }] };

  const errors: Array<{ index: number; error: string }> = [];
  const valid: Array<{ index: number; data: z.infer<typeof batchItemSchema> }> = [];

  items.forEach((raw, i) => {
    const parsed = batchItemSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push({ index: i, error: parsed.error.issues.map((x) => x.message).join("; ") });
      return;
    }
    const err = validateKindTargets({
      kind: parsed.data.kind,
      accountId: parsed.data.accountId ?? null,
      fromAccountId: parsed.data.fromAccountId ?? null,
      toAccountId: parsed.data.toAccountId ?? null,
    });
    if (err) {
      errors.push({ index: i, error: err });
      return;
    }
    valid.push({ index: i, data: parsed.data });
  });

  if (errors.length > 0) {
    return { errors, created: 0 };
  }

  const supabase = await createClient();
  const rows = valid.map(({ data: d }) => {
    const isTransfer = d.kind === "transfer";
    return {
      household_id: ctx.household.id,
      kind: d.kind,
      amount: d.amount,
      currency: d.currency,
      description: d.description.trim(),
      account_id: isTransfer ? null : (d.accountId ?? null),
      category_id: isTransfer ? null : (d.categoryId ?? null),
      payment_method: isTransfer ? null : (d.paymentMethod ?? null),
      from_account_id: isTransfer ? d.fromAccountId : null,
      to_account_id: isTransfer ? d.toAccountId : null,
      frequency: d.frequency as RecurrenceFrequency,
      interval_count: d.intervalCount,
      day_of_month: d.dayOfMonth ?? null,
      day_of_week: d.dayOfWeek ?? null,
      start_date: d.startDate,
      end_date: d.endDate ?? null,
      notes: d.notes?.trim() ?? null,
      created_by: ctx.profile.id,
    };
  });

  const { data, error } = await supabase.from("recurring_rules").insert(rows).select("id");
  if (error) return { errors: [{ index: -1, error: error.message }] };

  for (const p of pathsToInvalidate()) revalidatePath(p);
  return { ok: true, created: data?.length ?? 0 };
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
