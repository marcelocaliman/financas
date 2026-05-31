"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";

/**
 * Ações do modo revisão do IR: o usuário resolve uma renda que o motor não
 * classificou, escolhendo o bucket. A decisão é persistida por
 * (household, ano, origin_key) e aplicada na próxima apuração.
 */

const setSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  originKey: z.string().min(1),
  bucket: z.enum(["tributavel", "isento", "exclusivo"]),
  receitaCode: z.string().trim().max(4).optional().or(z.literal("")),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export type ClassifyState = { ok?: boolean; error?: string };

export async function setIncomeClassification(
  input: z.input<typeof setSchema>,
): Promise<ClassifyState> {
  const parsed = setSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { error } = await supabase.from("ir_income_classifications").upsert(
    {
      household_id: ctx.household.id,
      year: parsed.data.year,
      origin_key: parsed.data.originKey,
      bucket: parsed.data.bucket,
      receita_code: parsed.data.receitaCode || null,
      note: parsed.data.note || null,
    },
    { onConflict: "household_id,year,origin_key" },
  );
  if (error) return { error: error.message };

  revalidatePath("/ir", "layout");
  return { ok: true };
}

export async function clearIncomeClassification(
  year: number,
  originKey: string,
): Promise<ClassifyState> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("ir_income_classifications")
    .delete()
    .eq("household_id", ctx.household.id)
    .eq("year", year)
    .eq("origin_key", originKey);
  if (error) return { error: error.message };

  revalidatePath("/ir", "layout");
  return { ok: true };
}
