"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";
import { suggestCategory } from "@/lib/financial/auto-categorize";
import { matchCategoryRule } from "@/services/category-rules";
import { getRateMap } from "@/services/currency";
import { convertOrSame } from "@/lib/financial/currency";
import type { Currency } from "@/types/database";

const PAYMENT_METHODS = ["credit", "debit", "pix", "cash", "auto_debit", "transfer"] as const;
const CURRENCIES = ["BRL", "EUR", "USD"] as const;

const baseSchema = z.object({
  amount: z.coerce.number().positive("Valor precisa ser positivo."),
  currency: z.enum(CURRENCIES).optional(),
  amountAccount: z.coerce.number().nonnegative().optional(),
  description: z.string().min(1, "Descreva em poucas palavras."),
  accountId: z.string().uuid("Selecione uma conta."),
  categoryId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  // IR fields (apenas pra income)
  fontePagadoraId: z.string().uuid().optional().nullable(),
  irrfAmount: z.coerce.number().nonnegative().optional().nullable(),
  inssAmount: z.coerce.number().nonnegative().optional().nullable(),
  // Marca como "histórica pra IR" — não afeta saldo nem entra em dashboards
  isHistoricalIrOnly: z.coerce.boolean().optional().default(false),
});

const expenseOrIncomeSchema = baseSchema.extend({
  kind: z.enum(["income", "expense"]),
});

const transferSchema = z.object({
  amount: z.coerce.number().positive("Valor precisa ser positivo."),
  fromAccountId: z.string().uuid(),
  toAccountId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().optional(),
});

export type TxFormState = {
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
  return ["/dashboard", "/transacoes", "/contas", "/analise"];
}

export async function createTransaction(
  _prev: TxFormState | undefined,
  formData: FormData,
): Promise<TxFormState> {
  const kind = String(formData.get("kind") ?? "expense");

  if (kind === "transfer") {
    const parsed = transferSchema.safeParse({
      amount: formData.get("amount"),
      fromAccountId: formData.get("fromAccountId"),
      toAccountId: formData.get("toAccountId"),
      date: formData.get("date"),
      description: formData.get("description") || undefined,
    });
    if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

    if (parsed.data.fromAccountId === parsed.data.toAccountId) {
      return { fieldErrors: { toAccountId: "Origem e destino devem ser contas diferentes." } };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("create_transfer", {
      p_from_account_id: parsed.data.fromAccountId,
      p_to_account_id: parsed.data.toAccountId,
      p_amount: parsed.data.amount,
      p_date: parsed.data.date,
      p_description: parsed.data.description ?? null,
    });
    if (error) return { error: error.message };
    for (const p of pathsToInvalidate()) revalidatePath(p);
    return { ok: true };
  }

  const parsed = expenseOrIncomeSchema.safeParse({
    kind,
    amount: formData.get("amount"),
    currency: formData.get("currency") || undefined,
    amountAccount: formData.get("amountAccount") || undefined,
    description: formData.get("description"),
    accountId: formData.get("accountId"),
    categoryId: formData.get("categoryId") || undefined,
    date: formData.get("date"),
    paymentMethod: formData.get("paymentMethod") || undefined,
    fontePagadoraId: formData.get("fontePagadoraId") || null,
    irrfAmount: formData.get("irrfAmount") || null,
    inssAmount: formData.get("inssAmount") || null,
    isHistoricalIrOnly: formData.get("isHistoricalIrOnly") === "1",
  });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();

  // Resolve a moeda da transação: default = moeda da conta.
  const { data: acc } = await supabase
    .from("accounts")
    .select("currency")
    .eq("id", parsed.data.accountId)
    .maybeSingle();
  const accountCurrency = (acc?.currency ?? "BRL") as Currency;
  const txCurrency: Currency = parsed.data.currency ?? accountCurrency;

  // amount_account = valor que efetivamente debita/credita a conta (sempre na moeda da conta).
  // Se igual à moeda da transação, copia. Senão, ou o usuário forneceu, ou convertemos via taxa.
  let amountAccount = parsed.data.amountAccount;
  if (amountAccount === undefined || amountAccount === null) {
    if (txCurrency === accountCurrency) {
      amountAccount = parsed.data.amount;
    } else {
      const rates = await getRateMap();
      amountAccount = convertOrSame(parsed.data.amount, txCurrency, accountCurrency, rates);
    }
  }

  // Auto-categorização: se o usuário não escolheu categoria, tentamos sugerir
  // por matching de regras nas categorias do household.
  let resolvedCategoryId = parsed.data.categoryId ?? null;
  let categorySource: "manual" | "rule" = "manual";
  let categoryConfidence: number | null = null;

  if (!resolvedCategoryId) {
    // 1) Tenta regras user-defined (category_rules) — prioridade máxima
    const userRule = await matchCategoryRule(
      parsed.data.description,
      parsed.data.kind,
      ctx.household.id,
    );
    if (userRule) {
      resolvedCategoryId = userRule.categoryId;
      categorySource = "rule";
      categoryConfidence = 1.0;
    } else {
      // 2) Fallback: regras automáticas dentro de cada category (legado)
      const { data: cats } = await supabase
        .from("categories")
        .select("id, kind, rules")
        .eq("is_archived", false);
      const suggestion = suggestCategory(parsed.data.description, parsed.data.kind, cats ?? []);
      if (suggestion) {
        resolvedCategoryId = suggestion.categoryId;
        categorySource = "rule";
        categoryConfidence = suggestion.confidence;
      }
    }
  }

  const { error } = await supabase.from("transactions").insert({
    household_id: ctx.household.id,
    account_id: parsed.data.accountId,
    category_id: resolvedCategoryId,
    kind: parsed.data.kind,
    amount: parsed.data.amount,
    amount_account: amountAccount,
    currency: txCurrency,
    description: parsed.data.description.trim(),
    payment_method: parsed.data.paymentMethod ?? null,
    date: parsed.data.date,
    created_by: ctx.profile.id,
    category_source: categorySource,
    category_confidence: categoryConfidence,
    fonte_pagadora_id: parsed.data.kind === "income" ? (parsed.data.fontePagadoraId ?? null) : null,
    irrf_amount: parsed.data.kind === "income" ? (parsed.data.irrfAmount ?? null) : null,
    inss_amount: parsed.data.kind === "income" ? (parsed.data.inssAmount ?? null) : null,
    is_historical_ir_only: parsed.data.isHistoricalIrOnly ?? false,
  });
  if (error) return { error: error.message };

  for (const p of pathsToInvalidate()) revalidatePath(p);
  return { ok: true };
}

const updateSchema = expenseOrIncomeSchema.extend({ id: z.string().uuid() });

export async function updateTransaction(
  _prev: TxFormState | undefined,
  formData: FormData,
): Promise<TxFormState> {
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    kind: formData.get("kind"),
    amount: formData.get("amount"),
    currency: formData.get("currency") || undefined,
    amountAccount: formData.get("amountAccount") || undefined,
    description: formData.get("description"),
    accountId: formData.get("accountId"),
    categoryId: formData.get("categoryId") || undefined,
    date: formData.get("date"),
    paymentMethod: formData.get("paymentMethod") || undefined,
    isHistoricalIrOnly: formData.get("isHistoricalIrOnly") === "1",
  });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const supabase = await createClient();

  // Recalcula amount_account igual ao create.
  const { data: acc } = await supabase
    .from("accounts")
    .select("currency")
    .eq("id", parsed.data.accountId)
    .maybeSingle();
  const accountCurrency = (acc?.currency ?? "BRL") as Currency;
  const txCurrency: Currency = parsed.data.currency ?? accountCurrency;
  let amountAccount = parsed.data.amountAccount;
  if (amountAccount === undefined || amountAccount === null) {
    if (txCurrency === accountCurrency) {
      amountAccount = parsed.data.amount;
    } else {
      const rates = await getRateMap();
      amountAccount = convertOrSame(parsed.data.amount, txCurrency, accountCurrency, rates);
    }
  }

  const { error } = await supabase
    .from("transactions")
    .update({
      account_id: parsed.data.accountId,
      category_id: parsed.data.categoryId ?? null,
      kind: parsed.data.kind,
      amount: parsed.data.amount,
      amount_account: amountAccount,
      currency: txCurrency,
      description: parsed.data.description.trim(),
      payment_method: parsed.data.paymentMethod ?? null,
      date: parsed.data.date,
      is_historical_ir_only: parsed.data.isHistoricalIrOnly ?? false,
    })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  for (const p of pathsToInvalidate()) revalidatePath(p);
  return { ok: true };
}

/**
 * Toggle rápido pra marcar/desmarcar uma transaction como histórica IR
 * (informativa pra IR, não afeta saldo nem entra em dashboards operacionais).
 * Usado pelo botão de archive no row de /transacoes.
 */
export async function toggleHistoricalIrOnly(
  id: string,
  value: boolean,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ is_historical_ir_only: value })
    .eq("id", id);
  if (error) return { error: error.message };
  for (const p of pathsToInvalidate()) revalidatePath(p);
  return { ok: true };
}

export async function deleteTransaction(id: string): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  // Se for parte de uma transferência, apagar o par inteiro via RPC.
  const { data: row } = await supabase
    .from("transactions")
    .select("transfer_pair_id")
    .eq("id", id)
    .maybeSingle();

  if (row?.transfer_pair_id) {
    const { error } = await supabase.rpc("delete_transfer", { p_pair_id: row.transfer_pair_id });
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) return { error: error.message };
  }

  for (const p of pathsToInvalidate()) revalidatePath(p);
  return { ok: true };
}

/**
 * Atualiza tags de uma transação. Substitui inteiro (não append).
 */
export async function setTransactionTags(
  id: string,
  tags: string[],
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const clean = Array.from(new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean)));
  const { error } = await supabase
    .from("transactions")
    .update({ tags: clean })
    .eq("id", id);
  if (error) return { error: error.message };
  for (const p of pathsToInvalidate()) revalidatePath(p);
  return { ok: true };
}
