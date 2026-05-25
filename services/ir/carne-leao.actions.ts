"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";
import { computeCarneLeaoTax, lastBusinessDayOfNextMonth } from "@/services/ir/carne-leao";
import type { IRFormState } from "@/services/ir/actions";

const KINDS = ["aluguel", "freelance_pf", "pensao_recebida", "exterior_trabalho", "outros"] as const;

const baseSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  kind: z.enum(KINDS),
  description: z.string().min(1),
  source_name: z.string().optional().nullable(),
  source_cpf_cnpj: z.string().optional().nullable(),
  gross_amount: z.coerce.number().positive(),
  deductible_expenses: z.coerce.number().nonnegative().default(0),
  notes: z.string().optional().nullable(),
});

const updateSchema = baseSchema.extend({ id: z.string().uuid() });

function parseErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of error.issues) {
    const p = i.path.join(".");
    if (p && !out[p]) out[p] = i.message;
  }
  return out;
}

function readForm(formData: FormData) {
  return {
    year: formData.get("year"),
    month: formData.get("month"),
    kind: formData.get("kind"),
    description: formData.get("description"),
    source_name: formData.get("source_name") || null,
    source_cpf_cnpj: formData.get("source_cpf_cnpj") || null,
    gross_amount: formData.get("gross_amount"),
    deductible_expenses: formData.get("deductible_expenses") ?? 0,
    notes: formData.get("notes") || null,
  };
}

export async function createCarneLeao(
  _prev: IRFormState | undefined,
  formData: FormData,
): Promise<IRFormState> {
  const parsed = baseSchema.safeParse(readForm(formData));
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };
  const supabase = await createClient();

  const calc = computeCarneLeaoTax({
    grossAmount: parsed.data.gross_amount,
    deductibleExpenses: parsed.data.deductible_expenses,
    year: parsed.data.year,
    month: parsed.data.month,
  });

  const { error } = await supabase.from("carne_leao_mensal").insert({
    household_id: ctx.household.id,
    year: parsed.data.year,
    month: parsed.data.month,
    kind: parsed.data.kind,
    description: parsed.data.description.trim(),
    source_name: parsed.data.source_name?.trim() || null,
    source_cpf_cnpj: parsed.data.source_cpf_cnpj?.replace(/\D/g, "") || null,
    gross_amount: parsed.data.gross_amount,
    deductible_expenses: parsed.data.deductible_expenses,
    taxable_base: calc.taxableBase,
    tax_due: calc.taxDue,
    due_date: calc.dueDate ?? lastBusinessDayOfNextMonth(parsed.data.year, parsed.data.month),
    notes: parsed.data.notes?.trim() || null,
    tax_computed_by_app: true,
    computation_breakdown: calc.breakdown as never,
  });
  if (error) return { error: error.message };

  revalidatePath(`/ir/${parsed.data.year}`);
  revalidatePath(`/ir/${parsed.data.year}/configuracoes`);
  return { ok: true };
}

export async function deleteCarneLeao(id: string, year: number): Promise<IRFormState> {
  const supabase = await createClient();
  const { error } = await supabase.from("carne_leao_mensal").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/ir/${year}`);
  return { ok: true };
}

export async function markCarneLeaoPaid(args: {
  id: string;
  paidAt: string;
  reference?: string;
}): Promise<IRFormState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("carne_leao_mensal")
    .update({
      paid_at: args.paidAt,
      payment_reference: args.reference ?? null,
    })
    .eq("id", args.id);
  if (error) return { error: error.message };
  revalidatePath("/ir");
  return { ok: true };
}
