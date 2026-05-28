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
  currency: z.enum(["BRL", "EUR", "USD", "GBP"]).default("BRL"),
  depreciationMethod: z.enum(["none", "linear"]).default("none"),
  depreciationYears: z.coerce.number().int().positive().optional(),
  // IR — campos opcionais por categoria
  registrationNumber: z.string().optional(),  // matrícula (imóvel) ou RENAVAM (veículo)
  address: z.string().optional(),
  // Imóveis
  registryOffice: z.string().optional(),
  iptuRegistration: z.string().optional(),
  areaSqm: z.coerce.number().positive().optional(),
  ownershipPercent: z.coerce.number().min(0).max(100).optional(),
  // Veículos
  brand: z.string().optional(),
  model: z.string().optional(),
  manufactureYear: z.coerce.number().int().min(1900).max(2100).optional(),
  licensePlate: z.string().optional(),
  // Participação societária (category=other com code 31/32/39/49)
  cnpj: z.string().optional(),
  receitaCode: z.string().optional(),
  // Couple attribution
  ownerFilerId: z.string().uuid().optional().nullable(),
  isParticular: z.coerce.boolean().optional().default(false),
  particularReason: z.enum(["pre_casamento", "heranca", "doacao", "sub_rogacao", "outros"]).optional().nullable(),
  excludeFromIr: z.coerce.boolean().optional().default(false),
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

function parseFromFormData(formData: FormData) {
  return {
    name: formData.get("name"),
    category: formData.get("category"),
    description: formData.get("description") || undefined,
    acquiredAt: formData.get("acquiredAt") || undefined,
    acquiredValue: formData.get("acquiredValue") ?? 0,
    currentValue: formData.get("currentValue"),
    currency: formData.get("currency") || "BRL",
    depreciationMethod: formData.get("depreciationMethod") || "none",
    depreciationYears: formData.get("depreciationYears") || undefined,
    registrationNumber: formData.get("registrationNumber") || undefined,
    address: formData.get("address") || undefined,
    registryOffice: formData.get("registryOffice") || undefined,
    iptuRegistration: formData.get("iptuRegistration") || undefined,
    areaSqm: formData.get("areaSqm") || undefined,
    ownershipPercent: formData.get("ownershipPercent") || undefined,
    brand: formData.get("brand") || undefined,
    model: formData.get("model") || undefined,
    manufactureYear: formData.get("manufactureYear") || undefined,
    licensePlate: formData.get("licensePlate") || undefined,
    cnpj: formData.get("cnpj") || undefined,
    receitaCode: formData.get("receitaCode") || undefined,
    ownerFilerId: formData.get("ownerFilerId") || null,
    isParticular: formData.get("isParticular") === "1" || formData.get("isParticular") === "true",
    particularReason: formData.get("particularReason") || null,
    excludeFromIr: formData.get("excludeFromIr") === "1" || formData.get("excludeFromIr") === "true",
  };
}

/**
 * Constrói o payload de IR a partir do form parseado.
 * Só inclui campos relevantes pra categoria — evita "vazar" placa em um imóvel.
 */
function buildIRPayload(
  d: z.infer<typeof baseSchema>,
): Partial<{
  registration_number: string | null;
  address: string | null;
  registry_office: string | null;
  iptu_registration: string | null;
  area_sqm: number | null;
  ownership_percent: number | null;
  brand: string | null;
  model: string | null;
  manufacture_year: number | null;
  license_plate: string | null;
  cnpj: string | null;
  receita_code: string | null;
}> {
  if (d.category === "real_estate") {
    return {
      registration_number: d.registrationNumber?.trim() || null,
      address: d.address?.trim() || null,
      registry_office: d.registryOffice?.trim() || null,
      iptu_registration: d.iptuRegistration?.trim() || null,
      area_sqm: d.areaSqm ?? null,
      ownership_percent: d.ownershipPercent ?? null,
      // Limpa campos veículo + participação (em caso de troca de categoria)
      brand: null,
      model: null,
      manufacture_year: null,
      license_plate: null,
      cnpj: null,
    };
  }
  if (d.category === "vehicle") {
    return {
      registration_number: d.registrationNumber?.trim() || null, // RENAVAM
      brand: d.brand?.trim() || null,
      model: d.model?.trim() || null,
      manufacture_year: d.manufactureYear ?? null,
      license_plate: d.licensePlate?.trim().toUpperCase() || null,
      // Limpa campos imóvel + participação
      address: null,
      registry_office: null,
      iptu_registration: null,
      area_sqm: null,
      ownership_percent: null,
      cnpj: null,
    };
  }
  if (d.category === "other") {
    // "other" pode ser participação societária ou bem genérico — preserva
    // CNPJ e código Receita se preenchidos.
    return {
      registration_number: null,
      address: null,
      registry_office: null,
      iptu_registration: null,
      area_sqm: null,
      ownership_percent: null,
      brand: null,
      model: null,
      manufacture_year: null,
      license_plate: null,
      cnpj: d.cnpj?.trim() || null,
      receita_code: d.receitaCode?.trim() || null,
    };
  }
  // Outras categorias (electronics, jewelry, etc): limpa tudo
  return {
    registration_number: null,
    address: null,
    registry_office: null,
    iptu_registration: null,
    area_sqm: null,
    ownership_percent: null,
    brand: null,
    model: null,
    manufacture_year: null,
    license_plate: null,
    cnpj: null,
    receita_code: null,
  };
}

export async function createPhysicalAsset(
  _prev: PhysicalAssetFormState | undefined,
  formData: FormData,
): Promise<PhysicalAssetFormState> {
  const parsed = baseSchema.safeParse(parseFromFormData(formData));
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
    currency: parsed.data.currency,
    depreciation_method: parsed.data.depreciationMethod,
    depreciation_years: parsed.data.depreciationYears ?? null,
    owner_filer_id: parsed.data.ownerFilerId || null,
    is_particular: parsed.data.isParticular ?? false,
    particular_reason: parsed.data.particularReason ?? null,
    exclude_from_ir: parsed.data.excludeFromIr ?? false,
    ...buildIRPayload(parsed.data),
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
    ...parseFromFormData(formData),
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
      currency: parsed.data.currency,
      depreciation_method: parsed.data.depreciationMethod,
      depreciation_years: parsed.data.depreciationYears ?? null,
      owner_filer_id: parsed.data.ownerFilerId || null,
      is_particular: parsed.data.isParticular ?? false,
      particular_reason: parsed.data.particularReason ?? null,
      exclude_from_ir: parsed.data.excludeFromIr ?? false,
      ...buildIRPayload(parsed.data),
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
