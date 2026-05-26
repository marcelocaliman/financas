"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";
import { cpfRequired } from "@/lib/financial/cpf-cnpj-zod";

const REGIMES = [
  "solteiro",
  "comunhao_parcial",
  "comunhao_universal",
  "separacao_total",
  "separacao_obrigatoria",
  "participacao_final_aquestos",
] as const;
const DECL_STRATEGIES = ["separada", "conjunta", "auto"] as const;
const COMMON_STRATEGIES = ["split_50_50", "all_in_primary", "all_in_secondary"] as const;

const filerSchema = z.object({
  fullName: z.string().min(1, "Nome obrigatório."),
  cpf: cpfRequired,
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  occupation: z.string().optional(),
  occupationCode: z.string().optional(),
  natureOfOccupation: z.string().optional(),
  voterId: z.string().optional(),
});

const regimeSchema = z.object({
  marriageRegime: z.enum(REGIMES),
  marriageDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  declarationStrategy: z.enum(DECL_STRATEGIES),
  commonAssetsStrategy: z.enum(COMMON_STRATEGIES),
});

export type FilerFormState = {
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

export async function createShadowFiler(
  _prev: FilerFormState | undefined,
  formData: FormData,
): Promise<FilerFormState> {
  const parsed = filerSchema.safeParse({
    fullName: formData.get("fullName"),
    cpf: formData.get("cpf") ?? "",
    birthDate: formData.get("birthDate") ?? "",
    occupation: formData.get("occupation") || undefined,
    occupationCode: formData.get("occupationCode") || undefined,
    natureOfOccupation: formData.get("natureOfOccupation") || undefined,
    voterId: formData.get("voterId") || undefined,
  });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { error } = await supabase.from("ir_filers").insert({
    household_id: ctx.household.id,
    user_id: null,                  // perfil sombra
    full_name: parsed.data.fullName.trim(),
    cpf: parsed.data.cpf,
    birth_date: parsed.data.birthDate || null,
    occupation: parsed.data.occupation?.trim() || null,
    occupation_code: parsed.data.occupationCode?.trim() || null,
    nature_of_occupation: parsed.data.natureOfOccupation?.trim() || null,
    voter_id: parsed.data.voterId?.trim() || null,
    is_primary: false,
    is_active: true,
  });
  if (error) return { error: error.message };

  revalidatePath("/ir", "layout");
  return { ok: true };
}

export async function updateFiler(
  id: string,
  _prev: FilerFormState | undefined,
  formData: FormData,
): Promise<FilerFormState> {
  const parsed = filerSchema.safeParse({
    fullName: formData.get("fullName"),
    cpf: formData.get("cpf") ?? "",
    birthDate: formData.get("birthDate") ?? "",
    occupation: formData.get("occupation") || undefined,
    occupationCode: formData.get("occupationCode") || undefined,
    natureOfOccupation: formData.get("natureOfOccupation") || undefined,
    voterId: formData.get("voterId") || undefined,
  });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("ir_filers")
    .update({
      full_name: parsed.data.fullName.trim(),
      cpf: parsed.data.cpf,
      birth_date: parsed.data.birthDate || null,
      occupation: parsed.data.occupation?.trim() || null,
      occupation_code: parsed.data.occupationCode?.trim() || null,
      nature_of_occupation: parsed.data.natureOfOccupation?.trim() || null,
      voter_id: parsed.data.voterId?.trim() || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/ir", "layout");
  return { ok: true };
}

export async function archiveFiler(id: string): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  // Não permite arquivar primary — quebra o backfill / atribuição
  const { data: filer } = await supabase
    .from("ir_filers")
    .select("is_primary")
    .eq("id", id)
    .maybeSingle();
  if (filer?.is_primary) {
    return { error: "Não dá pra arquivar o titular principal. Promova outro filer primeiro." };
  }
  // Não permite arquivar se houver bens/rendas atribuídos — força re-atribuir antes
  const [accs, invs, phys, incs, deds, deps] = await Promise.all([
    supabase.from("accounts").select("id", { count: "exact", head: true }).eq("owner_filer_id", id),
    supabase.from("investments").select("id", { count: "exact", head: true }).eq("owner_filer_id", id),
    supabase.from("physical_assets").select("id", { count: "exact", head: true }).eq("owner_filer_id", id),
    supabase.from("ir_other_incomes").select("id", { count: "exact", head: true }).eq("owner_filer_id", id),
    supabase.from("ir_deductible_payments").select("id", { count: "exact", head: true }).eq("owner_filer_id", id),
    supabase.from("ir_dependents").select("id", { count: "exact", head: true }).eq("belongs_to_filer_id", id),
  ]);
  const refsTotal =
    (accs.count ?? 0) + (invs.count ?? 0) + (phys.count ?? 0) +
    (incs.count ?? 0) + (deds.count ?? 0) + (deps.count ?? 0);
  if (refsTotal > 0) {
    return {
      error:
        `Esse declarante ainda está vinculado a ${refsTotal} item(s) (contas, investimentos, bens, rendas, deduções ou dependentes). ` +
        `Re-atribua pra outro declarante antes de arquivar.`,
    };
  }
  const { error } = await supabase
    .from("ir_filers")
    .update({ is_active: false })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/ir", "layout");
  return { ok: true };
}

export async function updateRegime(
  _prev: FilerFormState | undefined,
  formData: FormData,
): Promise<FilerFormState> {
  const parsed = regimeSchema.safeParse({
    marriageRegime: formData.get("marriageRegime"),
    marriageDate: formData.get("marriageDate") ?? "",
    declarationStrategy: formData.get("declarationStrategy"),
    commonAssetsStrategy: formData.get("commonAssetsStrategy"),
  });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  // Validação cruzada: comunhão parcial exige data
  if (parsed.data.marriageRegime === "comunhao_parcial" && !parsed.data.marriageDate) {
    return { fieldErrors: { marriageDate: "Data do casamento obrigatória pra comunhão parcial." } };
  }

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("ir_settings")
    .upsert(
      {
        household_id: ctx.household.id,
        marriage_regime: parsed.data.marriageRegime,
        marriage_date: parsed.data.marriageDate || null,
        declaration_strategy: parsed.data.declarationStrategy,
        common_assets_strategy: parsed.data.commonAssetsStrategy,
      },
      { onConflict: "household_id" },
    );
  if (error) return { error: error.message };
  revalidatePath("/ir", "layout");
  return { ok: true };
}
