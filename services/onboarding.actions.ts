"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";
import type {
  CommonAssetsStrategy,
  DeclarationStrategy,
  FontePagadoraType,
  GoalType,
  IRDependentRelationship,
  MarriageRegime,
  Tables,
} from "@/types/database";

/**
 * Payload do wizard de onboarding — todos os passos compilados juntos.
 * É enviado de uma vez pra criar tudo atomicamente (best-effort).
 *
 * Campos opcionais (titular, spouse, dependents, fontes) tornam o IR
 * automático quando preenchidos no onboarding inicial.
 */
export type OnboardingPayload = {
  // PASSO 1 — Titular (essencial pro IR)
  titular?: {
    fullName: string;
    cpf: string;
    birthDate?: string;
    occupation?: string;
    occupationCode?: string;
  };
  // PASSO 2 — Cônjuge + regime de bens (opcional)
  spouse?: {
    fullName: string;
    cpf: string;
    birthDate?: string;
    occupation?: string;
    occupationCode?: string;
    marriageRegime: MarriageRegime;
    marriageDate?: string;
    declarationStrategy?: DeclarationStrategy;
    commonAssetsStrategy?: CommonAssetsStrategy;
  };
  // PASSO 3 — Dependentes (opcional)
  dependents?: Array<{
    name: string;
    cpf: string;
    birthDate?: string;
    relationship: IRDependentRelationship;
    /** Se houver spouse, indica em qual declaração entra (default: titular) */
    belongsToSpouse?: boolean;
  }>;
  // PASSO 4 — Contas (existente)
  accounts: Array<{
    name: string;
    institution: string;
    type: Tables<"accounts">["type"];
    initialBalance: number;
    // Específicos pra credit_card
    billCloseDay?: number;
    billDueDay?: number;
    creditLimit?: number;
  }>;
  // PASSO 5 — Fontes pagadoras (empresas/PFs que pagam você ou cônjuge)
  fontes?: Array<{
    type: FontePagadoraType;
    name: string;
    cnpj?: string;
    cpf?: string;
    defaultIrrfRate?: number;
    defaultInssRate?: number;
  }>;
  // PASSO 6 — Renda recorrente (linkada a fonte se cadastrada)
  incomes: Array<{
    description: string;
    amount: number;
    day: number;
    accountRef: string;
    /** Index na lista de fontes acima (ou null se não tem fonte) */
    fonteIdx?: number;
    /** Quem recebe — titular (default) ou spouse */
    forSpouse?: boolean;
    /** Valores médios mensais (vão pra recurring_rules) */
    irrfAmount?: number;
    inssAmount?: number;
  }>;
  // PASSO 7 — Despesas (existente)
  expenses: Array<{
    description: string;
    amount: number;
    day: number;
    accountRef: string;
    categoryHint: string;
  }>;
  goal?: {
    type: GoalType;
    name: string;
    targetAmount: number;
    currency: "BRL" | "EUR" | "USD" | "GBP";
    targetDate?: string;
  };
};

type AccountRow = Pick<Tables<"accounts">, "id" | "name" | "institution" | "type">;

function resolveAccountId(
  ref: string,
  existingByIdx: AccountRow[],
  createdByIdx: string[],
): string | null {
  if (ref.startsWith("existing-")) {
    const idx = Number(ref.replace("existing-", ""));
    return existingByIdx[idx]?.id ?? null;
  }
  if (ref.startsWith("new-")) {
    const idx = Number(ref.replace("new-", ""));
    return createdByIdx[idx] ?? null;
  }
  return null;
}

function cleanDigits(s?: string): string {
  return (s ?? "").replace(/\D/g, "");
}

export async function runOnboarding(
  payload: OnboardingPayload,
): Promise<{ ok?: boolean; error?: string }> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();

  // ============================================================
  // 1. TITULAR — upsert do filer primário
  // ============================================================
  let primaryFilerId: string | null = null;
  if (payload.titular?.cpf) {
    const cpf = cleanDigits(payload.titular.cpf);
    if (cpf.length !== 11) return { error: "CPF do titular inválido (11 dígitos)." };

    // Atualiza ou cria o filer primário (linkado ao user_id atual)
    const { data: existing } = await supabase
      .from("ir_filers")
      .select("id")
      .eq("household_id", ctx.household.id)
      .eq("is_primary", true)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("ir_filers")
        .update({
          full_name: payload.titular.fullName.trim(),
          cpf,
          birth_date: payload.titular.birthDate || null,
          occupation: payload.titular.occupation?.trim() || null,
          occupation_code: payload.titular.occupationCode?.trim() || null,
        })
        .eq("id", existing.id);
      primaryFilerId = existing.id;
    } else {
      const { data: created, error } = await supabase
        .from("ir_filers")
        .insert({
          household_id: ctx.household.id,
          user_id: ctx.profile.id,
          full_name: payload.titular.fullName.trim(),
          cpf,
          birth_date: payload.titular.birthDate || null,
          occupation: payload.titular.occupation?.trim() || null,
          occupation_code: payload.titular.occupationCode?.trim() || null,
          is_primary: true,
        })
        .select("id")
        .single();
      if (error) return { error: `Falha ao salvar titular: ${error.message}` };
      primaryFilerId = created.id;
    }

    // Sincroniza ir_settings.cpf_titular (compat) + titular_user_id
    await supabase
      .from("ir_settings")
      .upsert(
        {
          household_id: ctx.household.id,
          cpf_titular: cpf,
          titular_user_id: ctx.profile.id,
        },
        { onConflict: "household_id" },
      );
  }

  // ============================================================
  // 2. CÔNJUGE + REGIME — cria filer secundário + atualiza settings
  // ============================================================
  let spouseFilerId: string | null = null;
  if (payload.spouse?.cpf) {
    const cpf = cleanDigits(payload.spouse.cpf);
    if (cpf.length !== 11) return { error: "CPF do cônjuge inválido (11 dígitos)." };

    // Já existe um secundário?
    const { data: existing } = await supabase
      .from("ir_filers")
      .select("id")
      .eq("household_id", ctx.household.id)
      .eq("is_primary", false)
      .eq("is_active", true)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("ir_filers")
        .update({
          full_name: payload.spouse.fullName.trim(),
          cpf,
          birth_date: payload.spouse.birthDate || null,
          occupation: payload.spouse.occupation?.trim() || null,
          occupation_code: payload.spouse.occupationCode?.trim() || null,
        })
        .eq("id", existing.id);
      spouseFilerId = existing.id;
    } else {
      const { data: created, error } = await supabase
        .from("ir_filers")
        .insert({
          household_id: ctx.household.id,
          user_id: null, // perfil sombra
          full_name: payload.spouse.fullName.trim(),
          cpf,
          birth_date: payload.spouse.birthDate || null,
          occupation: payload.spouse.occupation?.trim() || null,
          occupation_code: payload.spouse.occupationCode?.trim() || null,
          is_primary: false,
        })
        .select("id")
        .single();
      if (error) return { error: `Falha ao salvar cônjuge: ${error.message}` };
      spouseFilerId = created.id;
    }

    // Regime + estratégia
    await supabase
      .from("ir_settings")
      .upsert(
        {
          household_id: ctx.household.id,
          marriage_regime: payload.spouse.marriageRegime,
          marriage_date: payload.spouse.marriageDate || null,
          declaration_strategy: payload.spouse.declarationStrategy ?? "auto",
          common_assets_strategy: payload.spouse.commonAssetsStrategy ?? "split_50_50",
        },
        { onConflict: "household_id" },
      );
  }

  // ============================================================
  // 3. DEPENDENTES
  // ============================================================
  for (const d of payload.dependents ?? []) {
    const cpf = cleanDigits(d.cpf);
    if (cpf.length !== 11) return { error: `CPF do dependente "${d.name}" inválido.` };
    const belongsTo = d.belongsToSpouse && spouseFilerId ? spouseFilerId : primaryFilerId;
    const { error } = await supabase.from("ir_dependents").insert({
      household_id: ctx.household.id,
      name: d.name.trim(),
      cpf,
      birth_date: d.birthDate || null,
      relationship: d.relationship,
      belongs_to_filer_id: belongsTo,
    });
    if (error) return { error: `Falha ao salvar dependente "${d.name}": ${error.message}` };
  }

  // ============================================================
  // 4. CONTAS (atribui ao titular por default)
  // ============================================================
  const createdAccountIds: string[] = [];
  for (const a of payload.accounts) {
    if (!a.name.trim() || !a.institution.trim()) continue;
    // Pra credit_card: initialBalance representa a fatura em aberto. Convertemos
    // pra saldo negativo (dívida) no banco. Default 0 = sem dívida pré-existente.
    const isCard = a.type === "credit_card";
    const balance = isCard ? -Math.abs(a.initialBalance ?? 0) : (a.initialBalance ?? 0);
    const { data, error } = await supabase
      .from("accounts")
      .insert({
        household_id: ctx.household.id,
        name: a.name.trim(),
        institution: a.institution.trim(),
        type: a.type,
        currency: "BRL",
        current_balance: balance,
        is_active: true,
        owner_filer_id: primaryFilerId,
        ...(isCard
          ? {
              bill_close_day: a.billCloseDay ?? null,
              bill_due_day: a.billDueDay ?? null,
              credit_limit: a.creditLimit ?? null,
            }
          : {}),
      })
      .select("id")
      .single();
    if (error) return { error: `Falha ao criar conta "${a.name}": ${error.message}` };
    createdAccountIds.push(data.id);
  }

  // Lista contas existentes
  const { data: existingAccounts } = await supabase
    .from("accounts")
    .select("id, name, institution, type")
    .eq("is_active", true);
  const existing = (existingAccounts ?? []) as AccountRow[];

  // ============================================================
  // 5. FONTES PAGADORAS
  // ============================================================
  const createdFonteIds: string[] = [];
  for (const f of payload.fontes ?? []) {
    if (!f.name.trim()) continue;
    const { data, error } = await supabase
      .from("fontes_pagadoras")
      .insert({
        household_id: ctx.household.id,
        type: f.type,
        name: f.name.trim(),
        cnpj: cleanDigits(f.cnpj) || null,
        cpf: cleanDigits(f.cpf) || null,
        default_irrf_rate: f.defaultIrrfRate ?? null,
        default_inss_rate: f.defaultInssRate ?? null,
        is_active: true,
      })
      .select("id")
      .single();
    if (error) return { error: `Falha ao criar fonte "${f.name}": ${error.message}` };
    createdFonteIds.push(data.id);
  }

  // ============================================================
  // 6. CATEGORIAS — lookup pra hint
  // ============================================================
  const { data: cats } = await supabase
    .from("categories")
    .select("id, name, kind")
    .eq("kind", "expense");
  const findCategory = (hint: string): string | null => {
    const lower = hint.toLowerCase();
    const c = (cats ?? []).find((c) => c.name.toLowerCase().includes(lower));
    return c?.id ?? null;
  };

  const today = new Date().toISOString().slice(0, 10);

  // ============================================================
  // 7. RECORRÊNCIAS DE RENDA (com fonte pagadora + IRRF/INSS)
  // ============================================================
  for (const i of payload.incomes) {
    const accId = resolveAccountId(i.accountRef, existing, createdAccountIds);
    if (!accId) continue;
    const fonteId =
      i.fonteIdx != null && createdFonteIds[i.fonteIdx]
        ? createdFonteIds[i.fonteIdx]
        : null;
    const { error } = await supabase.from("recurring_rules").insert({
      household_id: ctx.household.id,
      kind: "income",
      amount: i.amount,
      currency: "BRL",
      description: i.description,
      account_id: accId,
      frequency: "monthly",
      interval_count: 1,
      day_of_month: i.day,
      start_date: today,
      is_active: true,
      created_by: ctx.profile.id,
      fonte_pagadora_id: fonteId,
      irrf_amount: i.irrfAmount ?? null,
      inss_amount: i.inssAmount ?? null,
    });
    if (error) return { error: `Falha ao criar renda "${i.description}": ${error.message}` };
  }

  // ============================================================
  // 8. RECORRÊNCIAS DE DESPESA
  // ============================================================
  for (const e of payload.expenses) {
    const accId = resolveAccountId(e.accountRef, existing, createdAccountIds);
    if (!accId) continue;
    const catId = findCategory(e.categoryHint);
    const { error } = await supabase.from("recurring_rules").insert({
      household_id: ctx.household.id,
      kind: "expense",
      amount: e.amount,
      currency: "BRL",
      description: e.description,
      account_id: accId,
      category_id: catId,
      frequency: "monthly",
      interval_count: 1,
      day_of_month: e.day,
      start_date: today,
      is_active: true,
      created_by: ctx.profile.id,
    });
    if (error)
      return { error: `Falha ao criar despesa "${e.description}": ${error.message}` };
  }

  // ============================================================
  // 9. META (opcional)
  // ============================================================
  if (payload.goal && payload.goal.targetAmount > 0) {
    const { error } = await supabase.from("goals").insert({
      household_id: ctx.household.id,
      name: payload.goal.name,
      target_amount: payload.goal.targetAmount,
      current_amount: 0,
      currency: payload.goal.currency,
      target_date: payload.goal.targetDate ?? null,
      goal_type: payload.goal.type,
      priority: 1,
      allocation_mode: "waterfall",
      is_archived: false,
    });
    if (error) return { error: `Falha ao criar meta: ${error.message}` };
  }

  // ============================================================
  // 10. Marca onboarding como concluído + grava marco zero (app_start_date)
  // ============================================================
  const todayISO = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  await supabase
    .from("households")
    .update({
      onboarding_completed_at: new Date().toISOString(),
      app_start_date: todayISO,
    })
    .eq("id", ctx.household.id);

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Marca onboarding como pulado, sem criar nada. Banner não volta a aparecer.
 * Também grava o marco zero (app_start_date = hoje).
 */
export async function skipOnboarding(): Promise<{ ok?: boolean; error?: string }> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };
  const todayISO = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const supabase = await createClient();
  const { error } = await supabase
    .from("households")
    .update({
      onboarding_completed_at: new Date().toISOString(),
      app_start_date: todayISO,
    })
    .eq("id", ctx.household.id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}
