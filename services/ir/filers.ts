import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables, MarriageRegime, DeclarationStrategy, CommonAssetsStrategy } from "@/types/database";

export type Filer = Tables<"ir_filers">;

export type RegimeContext = {
  regime: MarriageRegime;
  marriageDate: string | null;
  declarationStrategy: DeclarationStrategy;
  commonAssetsStrategy: CommonAssetsStrategy;
};

/**
 * Lista filers ativos do household, primário primeiro.
 */
export async function listFilers(householdId?: string): Promise<Filer[]> {
  const supabase = await createClient();
  const q = supabase
    .from("ir_filers")
    .select("*")
    .eq("is_active", true)
    .order("is_primary", { ascending: false })
    .order("created_at");
  const { data } = householdId ? await q.eq("household_id", householdId) : await q;
  return data ?? [];
}

export async function getFilerById(id: string): Promise<Filer | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("ir_filers").select("*").eq("id", id).maybeSingle();
  return data ?? null;
}

export async function getPrimaryFiler(householdId?: string): Promise<Filer | null> {
  const supabase = await createClient();
  const q = supabase
    .from("ir_filers")
    .select("*")
    .eq("is_primary", true)
    .eq("is_active", true)
    .limit(1);
  const { data } = householdId ? await q.eq("household_id", householdId) : await q;
  return data?.[0] ?? null;
}

export async function getSecondaryFiler(householdId?: string): Promise<Filer | null> {
  const supabase = await createClient();
  const q = supabase
    .from("ir_filers")
    .select("*")
    .eq("is_primary", false)
    .eq("is_active", true)
    .order("created_at")
    .limit(1);
  const { data } = householdId ? await q.eq("household_id", householdId) : await q;
  return data?.[0] ?? null;
}

/**
 * Carrega o contexto de regime + estratégia do household.
 * Defaults seguros se ir_settings não existir.
 */
export async function getRegimeContext(householdId?: string): Promise<RegimeContext> {
  const supabase = await createClient();
  const q = supabase
    .from("ir_settings")
    .select("marriage_regime, marriage_date, declaration_strategy, common_assets_strategy");
  const { data } = householdId
    ? await q.eq("household_id", householdId).maybeSingle()
    : await q.maybeSingle();

  return {
    regime: (data?.marriage_regime ?? "solteiro") as MarriageRegime,
    marriageDate: data?.marriage_date ?? null,
    declarationStrategy: (data?.declaration_strategy ?? "auto") as DeclarationStrategy,
    commonAssetsStrategy: (data?.common_assets_strategy ?? "split_50_50") as CommonAssetsStrategy,
  };
}

/**
 * Retorna true se o household está configurado pra um casal (>= 2 filers ativos).
 */
export async function isCouple(householdId?: string): Promise<boolean> {
  const filers = await listFilers(householdId);
  return filers.length >= 2;
}
