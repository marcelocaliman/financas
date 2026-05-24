"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";
import { getBensReport } from "@/services/ir/bens";
import { getRendaVariavelReport, persistDarfs } from "@/services/ir/renda-variavel";

const CURRENCIES = ["BRL", "EUR", "USD"] as const;

export type IRFormState = {
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

function paths(year?: number) {
  const arr = ["/ir"];
  if (year) arr.push(`/ir/${year}`);
  return arr;
}

// ============================================================================
// Settings (titular + cpf + preferred_model)
// ============================================================================
const settingsSchema = z.object({
  preferred_model: z.enum(["simples", "completo", "auto"]).default("auto"),
  cpf_titular: z.string().optional().nullable(),
});

export async function upsertIRSettings(
  _prev: IRFormState | undefined,
  formData: FormData,
): Promise<IRFormState> {
  const parsed = settingsSchema.safeParse({
    preferred_model: formData.get("preferred_model") || "auto",
    cpf_titular: formData.get("cpf_titular") || null,
  });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };
  const supabase = await createClient();

  const { error } = await supabase.from("ir_settings").upsert(
    {
      household_id: ctx.household.id,
      preferred_model: parsed.data.preferred_model,
      cpf_titular: parsed.data.cpf_titular?.replace(/\D/g, "") || null,
      titular_user_id: ctx.profile.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "household_id" },
  );
  if (error) return { error: error.message };
  for (const p of paths()) revalidatePath(p);
  return { ok: true };
}

// ============================================================================
// Dependentes
// ============================================================================
const dependentSchema = z.object({
  name: z.string().min(1, "Nome obrigatório."),
  cpf: z.string().optional().nullable(),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  relationship: z.enum([
    "conjuge", "companheiro", "filho", "filha", "enteado",
    "pais", "avos", "irmaos", "menor_guarda", "outros",
  ]),
  notes: z.string().optional().nullable(),
});

export async function createDependent(
  _prev: IRFormState | undefined,
  formData: FormData,
): Promise<IRFormState> {
  const parsed = dependentSchema.safeParse({
    name: formData.get("name"),
    cpf: formData.get("cpf") || null,
    birth_date: formData.get("birth_date") || null,
    relationship: formData.get("relationship"),
    notes: formData.get("notes") || null,
  });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };
  const supabase = await createClient();

  const { error } = await supabase.from("ir_dependents").insert({
    household_id: ctx.household.id,
    name: parsed.data.name.trim(),
    cpf: parsed.data.cpf?.replace(/\D/g, "") || null,
    birth_date: parsed.data.birth_date,
    relationship: parsed.data.relationship,
    notes: parsed.data.notes?.trim() || null,
  });
  if (error) return { error: error.message };
  for (const p of paths()) revalidatePath(p);
  return { ok: true };
}

export async function deleteDependent(id: string): Promise<IRFormState> {
  const supabase = await createClient();
  const { error } = await supabase.from("ir_dependents").delete().eq("id", id);
  if (error) return { error: error.message };
  for (const p of paths()) revalidatePath(p);
  return { ok: true };
}

// ============================================================================
// Pagamentos dedutíveis
// ============================================================================
const deductibleSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  kind: z.string().min(1),
  description: z.string().min(1, "Descrição obrigatória."),
  recipient_name: z.string().min(1, "Beneficiário obrigatório."),
  recipient_cnpj_cpf: z.string().optional().nullable(),
  beneficiary: z.string().optional().nullable(),
  amount: z.coerce.number().positive("Valor deve ser positivo."),
  currency: z.enum(CURRENCIES).default("BRL"),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  is_dependent_payment: z.coerce.boolean().optional().default(false),
});

export async function createDeductiblePayment(
  _prev: IRFormState | undefined,
  formData: FormData,
): Promise<IRFormState> {
  const parsed = deductibleSchema.safeParse({
    year: formData.get("year"),
    kind: formData.get("kind"),
    description: formData.get("description"),
    recipient_name: formData.get("recipient_name"),
    recipient_cnpj_cpf: formData.get("recipient_cnpj_cpf") || null,
    beneficiary: formData.get("beneficiary") || null,
    amount: formData.get("amount"),
    currency: formData.get("currency") || "BRL",
    payment_date: formData.get("payment_date") || null,
    is_dependent_payment: formData.get("is_dependent_payment") === "true",
  });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };
  const supabase = await createClient();

  const { error } = await supabase.from("ir_deductible_payments").insert({
    household_id: ctx.household.id,
    year: parsed.data.year,
    kind: parsed.data.kind as never,
    description: parsed.data.description.trim(),
    recipient_name: parsed.data.recipient_name.trim(),
    recipient_cnpj_cpf: parsed.data.recipient_cnpj_cpf?.replace(/\D/g, "") || null,
    beneficiary: parsed.data.beneficiary?.trim() || null,
    amount: parsed.data.amount,
    currency: parsed.data.currency,
    payment_date: parsed.data.payment_date,
    is_dependent_payment: parsed.data.is_dependent_payment,
  });
  if (error) return { error: error.message };
  for (const p of paths(parsed.data.year)) revalidatePath(p);
  return { ok: true };
}

export async function deleteDeductiblePayment(id: string, year: number): Promise<IRFormState> {
  const supabase = await createClient();
  const { error } = await supabase.from("ir_deductible_payments").delete().eq("id", id);
  if (error) return { error: error.message };
  for (const p of paths(year)) revalidatePath(p);
  return { ok: true };
}

// ============================================================================
// Outras rendas manuais
// ============================================================================
const otherIncomeSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  category: z.enum([
    "tributavel_pj", "tributavel_pf", "isento", "exclusivo_fonte", "rendimento_acumulado",
  ]),
  description: z.string().min(1),
  source_name: z.string().min(1),
  source_cnpj_cpf: z.string().optional().nullable(),
  gross_amount: z.coerce.number().positive(),
  irrf_amount: z.coerce.number().nonnegative().default(0),
  inss_amount: z.coerce.number().nonnegative().default(0),
  thirteenth_amount: z.coerce.number().nonnegative().default(0),
  currency: z.enum(CURRENCIES).default("BRL"),
});

export async function createOtherIncome(
  _prev: IRFormState | undefined,
  formData: FormData,
): Promise<IRFormState> {
  const parsed = otherIncomeSchema.safeParse({
    year: formData.get("year"),
    category: formData.get("category"),
    description: formData.get("description"),
    source_name: formData.get("source_name"),
    source_cnpj_cpf: formData.get("source_cnpj_cpf") || null,
    gross_amount: formData.get("gross_amount"),
    irrf_amount: formData.get("irrf_amount") ?? 0,
    inss_amount: formData.get("inss_amount") ?? 0,
    thirteenth_amount: formData.get("thirteenth_amount") ?? 0,
    currency: formData.get("currency") || "BRL",
  });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };
  const supabase = await createClient();

  const { error } = await supabase.from("ir_other_incomes").insert({
    household_id: ctx.household.id,
    year: parsed.data.year,
    category: parsed.data.category as never,
    description: parsed.data.description.trim(),
    source_name: parsed.data.source_name.trim(),
    source_cnpj_cpf: parsed.data.source_cnpj_cpf?.replace(/\D/g, "") || null,
    gross_amount: parsed.data.gross_amount,
    irrf_amount: parsed.data.irrf_amount,
    inss_amount: parsed.data.inss_amount,
    thirteenth_amount: parsed.data.thirteenth_amount,
    currency: parsed.data.currency,
  });
  if (error) return { error: error.message };
  for (const p of paths(parsed.data.year)) revalidatePath(p);
  return { ok: true };
}

export async function deleteOtherIncome(id: string, year: number): Promise<IRFormState> {
  const supabase = await createClient();
  const { error } = await supabase.from("ir_other_incomes").delete().eq("id", id);
  if (error) return { error: error.message };
  for (const p of paths(year)) revalidatePath(p);
  return { ok: true };
}

// ============================================================================
// Recalcular DARFs do ano (persistir)
// ============================================================================
export async function recomputeDarfs(year: number): Promise<IRFormState & { persisted?: number }> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };
  const report = await getRendaVariavelReport(year);
  try {
    const r = await persistDarfs(ctx.household.id, report);
    for (const p of paths(year)) revalidatePath(p);
    return { ok: true, persisted: r.persisted };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao persistir DARFs.";
    return { error: msg };
  }
}

// ============================================================================
// Marcar DARF como pago
// ============================================================================
export async function markDarfPaid(args: {
  id: string;
  paidAt: string;
  reference?: string;
}): Promise<IRFormState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ir_darfs")
    .update({
      paid_at: args.paidAt,
      payment_reference: args.reference ?? null,
    })
    .eq("id", args.id);
  if (error) return { error: error.message };
  revalidatePath("/ir");
  return { ok: true };
}

// ============================================================================
// Fechar declaração do ano (gera snapshot pra carryover)
// ============================================================================
export async function closeYearDeclaration(year: number): Promise<IRFormState> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };
  const supabase = await createClient();

  const bens = await getBensReport(year);
  const flatBens = bens.byGroup.flatMap((g) => g.items);

  const { error } = await supabase.from("ir_year_snapshots").upsert(
    {
      household_id: ctx.household.id,
      year,
      bens: flatBens as never,
      totals: bens.totals as never,
      closed_at: new Date().toISOString(),
    },
    { onConflict: "household_id,year" },
  );
  if (error) return { error: error.message };

  // Atualiza last_year_prepared
  await supabase.from("ir_settings").upsert(
    {
      household_id: ctx.household.id,
      last_year_prepared: year,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "household_id" },
  );

  for (const p of paths(year)) revalidatePath(p);
  return { ok: true };
}
