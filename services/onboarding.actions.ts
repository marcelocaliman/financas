"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";
import type { GoalType, Tables } from "@/types/database";

/**
 * Payload do wizard de onboarding — todos os passos compilados juntos.
 * É enviado de uma vez pra criar tudo atomicamente.
 *
 * `accountRef` em incomes/expenses é "existing-<id>" ou "new-<idx>" —
 * resolvido pra account_id real depois de criar as contas.
 */
export type OnboardingPayload = {
  accounts: Array<{
    name: string;
    institution: string;
    type: Tables<"accounts">["type"];
    initialBalance: number;
  }>;
  incomes: Array<{
    description: string;
    amount: number;
    day: number; // 1-31
    accountRef: string;
  }>;
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
    currency: "BRL" | "EUR" | "USD";
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

export async function runOnboarding(
  payload: OnboardingPayload,
): Promise<{ ok?: boolean; error?: string }> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();

  // 1. Cria contas (em sequência pra ter os IDs na ordem do payload)
  const createdAccountIds: string[] = [];
  for (const a of payload.accounts) {
    if (!a.name.trim() || !a.institution.trim()) continue;
    const { data, error } = await supabase
      .from("accounts")
      .insert({
        household_id: ctx.household.id,
        name: a.name.trim(),
        institution: a.institution.trim(),
        type: a.type,
        currency: "BRL",
        current_balance: a.initialBalance ?? 0,
        is_active: true,
      })
      .select("id")
      .single();
    if (error) return { error: `Falha ao criar conta "${a.name}": ${error.message}` };
    createdAccountIds.push(data.id);
  }

  // 2. Lista contas existentes (na mesma ordem que foram passadas ao wizard)
  const { data: existingAccounts } = await supabase
    .from("accounts")
    .select("id, name, institution, type")
    .eq("is_active", true);
  const existing = (existingAccounts ?? []) as AccountRow[];

  // 3. Busca categorias do household pra mapear categoryHint → category_id
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

  // 4. Cria recorrências de renda
  for (const i of payload.incomes) {
    const accId = resolveAccountId(i.accountRef, existing, createdAccountIds);
    if (!accId) continue;
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
    });
    if (error) return { error: `Falha ao criar renda "${i.description}": ${error.message}` };
  }

  // 5. Cria recorrências de despesa
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

  // 6. Cria meta inicial (opcional)
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

  // 7. Marca onboarding como concluído (esconde banner pra sempre)
  await supabase
    .from("households")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", ctx.household.id);

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Marca onboarding como pulado, sem criar nada. Banner não volta a aparecer.
 * Usado quando o usuário fecha o banner sem entrar no wizard.
 */
export async function skipOnboarding(): Promise<{ ok?: boolean; error?: string }> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("households")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", ctx.household.id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}
