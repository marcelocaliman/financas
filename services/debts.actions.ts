"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";

const KINDS = [
  "financiamento_imovel",
  "financiamento_veiculo",
  "emprestimo_pessoal",
  "emprestimo_cheque_especial",
  "emprestimo_cartao_credito",
  "parcelamento_cartao",
  "emprestimo_pj",
  "emprestimo_pessoa_fisica",
  "outros",
] as const;

const CURRENCIES = ["BRL", "EUR", "USD", "GBP"] as const;
const PARTICULAR_REASONS = ["pre_casamento", "heranca", "doacao", "sub_rogacao", "outros"] as const;

const schema = z.object({
  kind: z.enum(KINDS),
  description: z.string().min(1, "Descrição obrigatória."),
  creditorName: z.string().min(1, "Credor obrigatório."),
  creditorCnpjCpf: z.string().optional().nullable(),
  originalAmount: z.coerce.number().nonnegative().default(0),
  currentBalance: z.coerce.number().nonnegative().default(0),
  currency: z.enum(CURRENCIES).default("BRL"),
  contractDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  interestRate: z.coerce.number().nonnegative().optional().nullable(),
  physicalAssetId: z.string().uuid().optional().nullable(),
  ownerFilerId: z.string().uuid().optional().nullable(),
  isParticular: z.coerce.boolean().optional().default(false),
  particularReason: z.enum(PARTICULAR_REASONS).optional().nullable(),
  ownershipPercent: z.coerce.number().min(0).max(100).optional().nullable(),
  notes: z.string().optional().nullable(),
});

const updateSchema = schema.extend({ id: z.string().uuid() });

export type DebtFormState = {
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

function readForm(formData: FormData) {
  return {
    kind: formData.get("kind"),
    description: formData.get("description"),
    creditorName: formData.get("creditorName"),
    creditorCnpjCpf: formData.get("creditorCnpjCpf") || null,
    originalAmount: formData.get("originalAmount") ?? 0,
    currentBalance: formData.get("currentBalance") ?? 0,
    currency: formData.get("currency") || "BRL",
    contractDate: formData.get("contractDate") || "",
    endDate: formData.get("endDate") || "",
    interestRate: formData.get("interestRate") || null,
    physicalAssetId: formData.get("physicalAssetId") || null,
    ownerFilerId: formData.get("ownerFilerId") || null,
    isParticular: formData.get("isParticular") === "1" || formData.get("isParticular") === "true",
    particularReason: formData.get("particularReason") || null,
    ownershipPercent: formData.get("ownershipPercent") || null,
    notes: formData.get("notes") || null,
  };
}

export async function createDebt(
  _prev: DebtFormState | undefined,
  formData: FormData,
): Promise<DebtFormState> {
  const parsed = schema.safeParse(readForm(formData));
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { error } = await supabase.from("debts").insert({
    household_id: ctx.household.id,
    kind: parsed.data.kind,
    description: parsed.data.description.trim(),
    creditor_name: parsed.data.creditorName.trim(),
    creditor_cnpj_cpf: parsed.data.creditorCnpjCpf?.replace(/\D/g, "") || null,
    original_amount: parsed.data.originalAmount,
    current_balance: parsed.data.currentBalance,
    currency: parsed.data.currency,
    contract_date: parsed.data.contractDate || null,
    end_date: parsed.data.endDate || null,
    interest_rate: parsed.data.interestRate ?? null,
    physical_asset_id: parsed.data.physicalAssetId ?? null,
    owner_filer_id: parsed.data.ownerFilerId ?? null,
    is_particular: parsed.data.isParticular ?? false,
    particular_reason: parsed.data.particularReason ?? null,
    ownership_percent: parsed.data.ownershipPercent ?? null,
    notes: parsed.data.notes?.trim() || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/dividas");
  revalidatePath("/patrimonio");
  revalidatePath("/ir", "layout");
  return { ok: true };
}

export async function updateDebt(
  _prev: DebtFormState | undefined,
  formData: FormData,
): Promise<DebtFormState> {
  const parsed = updateSchema.safeParse({ id: formData.get("id"), ...readForm(formData) });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("debts")
    .update({
      kind: parsed.data.kind,
      description: parsed.data.description.trim(),
      creditor_name: parsed.data.creditorName.trim(),
      creditor_cnpj_cpf: parsed.data.creditorCnpjCpf?.replace(/\D/g, "") || null,
      original_amount: parsed.data.originalAmount,
      current_balance: parsed.data.currentBalance,
      currency: parsed.data.currency,
      contract_date: parsed.data.contractDate || null,
      end_date: parsed.data.endDate || null,
      interest_rate: parsed.data.interestRate ?? null,
      physical_asset_id: parsed.data.physicalAssetId ?? null,
      owner_filer_id: parsed.data.ownerFilerId ?? null,
      is_particular: parsed.data.isParticular ?? false,
      particular_reason: parsed.data.particularReason ?? null,
      ownership_percent: parsed.data.ownershipPercent ?? null,
      notes: parsed.data.notes?.trim() || null,
    })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  revalidatePath("/dividas");
  revalidatePath("/patrimonio");
  revalidatePath("/ir", "layout");
  return { ok: true };
}

export async function archiveDebt(id: string): Promise<DebtFormState> {
  const supabase = await createClient();
  const { error } = await supabase.from("debts").update({ is_active: false }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dividas");
  revalidatePath("/patrimonio");
  return { ok: true };
}

export async function deleteDebt(id: string): Promise<DebtFormState> {
  const supabase = await createClient();
  const { error } = await supabase.from("debts").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dividas");
  revalidatePath("/patrimonio");
  return { ok: true };
}
