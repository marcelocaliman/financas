"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";

const CATEGORIES = [
  "real_estate",
  "vehicle",
  "electronics",
  "furniture",
  "jewelry",
  "art",
  "tools",
  "other",
] as const;

const baseSchema = z.object({
  name: z.string().min(1, "Dê um nome ao bem."),
  category: z.enum(CATEGORIES),
  description: z.string().optional(),
  acquiredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  acquiredValue: z.coerce.number().nonnegative().default(0),
  currentValue: z.coerce.number().nonnegative(),
  depreciationMethod: z.enum(["none", "linear"]).default("none"),
  depreciationYears: z.coerce.number().int().positive().optional(),
});

const updateSchema = baseSchema.extend({ id: z.string().uuid() });

export type PhysicalAssetFormState = {
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

function pathsToInvalidate() {
  return ["/patrimonio", "/dashboard"];
}

export async function createPhysicalAsset(
  _prev: PhysicalAssetFormState | undefined,
  formData: FormData,
): Promise<PhysicalAssetFormState> {
  const parsed = baseSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    description: formData.get("description") || undefined,
    acquiredAt: formData.get("acquiredAt") || undefined,
    acquiredValue: formData.get("acquiredValue") ?? 0,
    currentValue: formData.get("currentValue"),
    depreciationMethod: formData.get("depreciationMethod") || "none",
    depreciationYears: formData.get("depreciationYears") || undefined,
  });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { error } = await supabase.from("physical_assets").insert({
    household_id: ctx.household.id,
    name: parsed.data.name.trim(),
    category: parsed.data.category,
    description: parsed.data.description?.trim() ?? null,
    acquired_at: parsed.data.acquiredAt || null,
    acquired_value: parsed.data.acquiredValue,
    current_value: parsed.data.currentValue,
    depreciation_method: parsed.data.depreciationMethod,
    depreciation_years: parsed.data.depreciationYears ?? null,
  });
  if (error) return { error: error.message };

  for (const p of pathsToInvalidate()) revalidatePath(p);
  return { ok: true };
}

export async function updatePhysicalAsset(
  _prev: PhysicalAssetFormState | undefined,
  formData: FormData,
): Promise<PhysicalAssetFormState> {
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    category: formData.get("category"),
    description: formData.get("description") || undefined,
    acquiredAt: formData.get("acquiredAt") || undefined,
    acquiredValue: formData.get("acquiredValue") ?? 0,
    currentValue: formData.get("currentValue"),
    depreciationMethod: formData.get("depreciationMethod") || "none",
    depreciationYears: formData.get("depreciationYears") || undefined,
  });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("physical_assets")
    .update({
      name: parsed.data.name.trim(),
      category: parsed.data.category,
      description: parsed.data.description?.trim() ?? null,
      acquired_at: parsed.data.acquiredAt || null,
      acquired_value: parsed.data.acquiredValue,
      current_value: parsed.data.currentValue,
      depreciation_method: parsed.data.depreciationMethod,
      depreciation_years: parsed.data.depreciationYears ?? null,
    })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  for (const p of pathsToInvalidate()) revalidatePath(p);
  return { ok: true };
}

export async function archivePhysicalAsset(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("physical_assets")
    .update({ is_active: false })
    .eq("id", id);
  if (error) return { error: error.message };
  for (const p of pathsToInvalidate()) revalidatePath(p);
  return { ok: true };
}

export async function restorePhysicalAsset(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("physical_assets")
    .update({ is_active: true })
    .eq("id", id);
  if (error) return { error: error.message };
  for (const p of pathsToInvalidate()) revalidatePath(p);
  return { ok: true };
}

export async function deletePhysicalAsset(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("physical_assets").delete().eq("id", id);
  if (error) return { error: error.message };
  for (const p of pathsToInvalidate()) revalidatePath(p);
  return { ok: true };
}
