"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";

const TYPES = [
  "clt", "pj_propria", "pj_outros", "aluguel", "pensao",
  "aposentadoria", "bolsa", "outra",
] as const;
const REGIMES = ["mei", "simples_nacional", "lucro_presumido", "lucro_real"] as const;

const baseSchema = z.object({
  type: z.enum(TYPES),
  name: z.string().min(1, "Nome obrigatório."),
  cnpj: z.string().optional().nullable(),
  cpf: z.string().optional().nullable(),
  regime_tributario: z.enum(REGIMES).optional().nullable(),
  default_irrf_rate: z.coerce.number().nonnegative().optional().nullable(),
  default_inss_rate: z.coerce.number().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const updateSchema = baseSchema.extend({ id: z.string().uuid() });

export type FonteFormState = {
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
    type: formData.get("type"),
    name: formData.get("name"),
    cnpj: formData.get("cnpj") || null,
    cpf: formData.get("cpf") || null,
    regime_tributario: formData.get("regime_tributario") || null,
    default_irrf_rate: formData.get("default_irrf_rate") || null,
    default_inss_rate: formData.get("default_inss_rate") || null,
    notes: formData.get("notes") || null,
  };
}

export async function createFontePagadora(
  _prev: FonteFormState | undefined,
  formData: FormData,
): Promise<FonteFormState> {
  const parsed = baseSchema.safeParse(readForm(formData));
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };
  const supabase = await createClient();

  const { error } = await supabase.from("fontes_pagadoras").insert({
    household_id: ctx.household.id,
    type: parsed.data.type,
    name: parsed.data.name.trim(),
    cnpj: parsed.data.cnpj?.replace(/\D/g, "") || null,
    cpf: parsed.data.cpf?.replace(/\D/g, "") || null,
    regime_tributario: parsed.data.regime_tributario ?? null,
    default_irrf_rate: parsed.data.default_irrf_rate ?? null,
    default_inss_rate: parsed.data.default_inss_rate ?? null,
    notes: parsed.data.notes?.trim() ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath("/ir");
  return { ok: true };
}

export async function updateFontePagadora(
  _prev: FonteFormState | undefined,
  formData: FormData,
): Promise<FonteFormState> {
  const parsed = updateSchema.safeParse({ id: formData.get("id"), ...readForm(formData) });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("fontes_pagadoras")
    .update({
      type: parsed.data.type,
      name: parsed.data.name.trim(),
      cnpj: parsed.data.cnpj?.replace(/\D/g, "") || null,
      cpf: parsed.data.cpf?.replace(/\D/g, "") || null,
      regime_tributario: parsed.data.regime_tributario ?? null,
      default_irrf_rate: parsed.data.default_irrf_rate ?? null,
      default_inss_rate: parsed.data.default_inss_rate ?? null,
      notes: parsed.data.notes?.trim() ?? null,
    })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  revalidatePath("/ir");
  return { ok: true };
}

export async function deleteFontePagadora(id: string): Promise<FonteFormState> {
  const supabase = await createClient();
  const { error } = await supabase.from("fontes_pagadoras").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/ir");
  return { ok: true };
}
