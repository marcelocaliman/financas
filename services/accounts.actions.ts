"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";

const ACCOUNT_TYPES = ["checking", "savings", "credit_card", "investment", "cash"] as const;

const createSchema = z.object({
  institution: z.string().min(1, "Qual instituição? (Itaú, Nubank, XP…)"),
  type: z.enum(ACCOUNT_TYPES),
  name: z.string().min(1, "Dê um apelido pra essa conta."),
  color: z.string().optional(),
  initialBalance: z.coerce.number().default(0),
});

const updateSchema = createSchema.extend({
  id: z.string().uuid(),
});

export type AccountFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function parseFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (path && !out[path]) out[path] = issue.message;
  }
  return out;
}

export async function createAccount(
  _prev: AccountFormState | undefined,
  formData: FormData,
): Promise<AccountFormState> {
  const parsed = createSchema.safeParse({
    institution: formData.get("institution"),
    type: formData.get("type"),
    name: formData.get("name"),
    color: formData.get("color") || undefined,
    initialBalance: formData.get("initialBalance") ?? 0,
  });
  if (!parsed.success) return { fieldErrors: parseFieldErrors(parsed.error) };

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { error } = await supabase.from("accounts").insert({
    household_id: ctx.household.id,
    institution: parsed.data.institution.trim(),
    type: parsed.data.type,
    name: parsed.data.name.trim(),
    color: parsed.data.color ?? null,
    current_balance: parsed.data.initialBalance,
  });
  if (error) return { error: error.message };

  revalidatePath("/contas");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateAccount(
  _prev: AccountFormState | undefined,
  formData: FormData,
): Promise<AccountFormState> {
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    institution: formData.get("institution"),
    type: formData.get("type"),
    name: formData.get("name"),
    color: formData.get("color") || undefined,
    initialBalance: formData.get("initialBalance") ?? 0,
  });
  if (!parsed.success) return { fieldErrors: parseFieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("accounts")
    .update({
      institution: parsed.data.institution.trim(),
      type: parsed.data.type,
      name: parsed.data.name.trim(),
      color: parsed.data.color ?? null,
    })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  revalidatePath("/contas");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function archiveAccount(id: string): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("accounts").update({ is_active: false }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/contas");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function restoreAccount(id: string): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("accounts").update({ is_active: true }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/contas");
  return { ok: true };
}

/**
 * Ajusta o saldo criando uma transação de reconciliação (income/expense).
 * Mantém auditoria — não sobrescreve current_balance direto.
 */
export async function adjustAccountBalance(
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  const accountId = String(formData.get("accountId") ?? "");
  const targetBalance = Number(formData.get("targetBalance") ?? "NaN");
  const notes = String(formData.get("notes") ?? "").trim();

  if (!accountId || !z.string().uuid().safeParse(accountId).success) {
    return { error: "Conta inválida." };
  }
  if (!Number.isFinite(targetBalance)) {
    return { error: "Saldo informado inválido." };
  }

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { data: acc, error: accErr } = await supabase
    .from("accounts")
    .select("id, name, current_balance")
    .eq("id", accountId)
    .maybeSingle();
  if (accErr || !acc) return { error: "Conta não encontrada." };

  const current = Number(acc.current_balance);
  const delta = Math.round((targetBalance - current) * 100) / 100;
  if (delta === 0) return { ok: true };

  const kind = delta > 0 ? "income" : "expense";
  const amount = Math.abs(delta);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const { error: txErr } = await supabase.from("transactions").insert({
    household_id: ctx.household.id,
    account_id: accountId,
    kind,
    amount,
    description: notes || `Ajuste de saldo · ${acc.name}`,
    date: today,
    created_by: ctx.profile.id,
    category_source: "manual",
    metadata: { adjust: true, previous_balance: current, target_balance: targetBalance },
  });
  if (txErr) return { error: txErr.message };

  revalidatePath("/contas");
  revalidatePath("/dashboard");
  revalidatePath("/transacoes");
  return { ok: true };
}

/**
 * Deleta a conta DEFINITIVAMENTE.
 * Falha se houver transações ou investimentos atrelados (FK restrict).
 * Use archive para o caso geral; este só pra contas vazias criadas por engano.
 */
export async function deleteAccount(id: string): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  // Verifica dependências antes pra mensagem amigável
  const [{ count: txCount }, { count: invCount }] = await Promise.all([
    supabase.from("transactions").select("*", { count: "exact", head: true }).eq("account_id", id),
    supabase.from("investments").select("*", { count: "exact", head: true }).eq("account_id", id),
  ]);
  if ((txCount ?? 0) > 0 || (invCount ?? 0) > 0) {
    return {
      error:
        "Essa conta tem movimentações ou investimentos. Arquive em vez de excluir — o histórico fica preservado.",
    };
  }

  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/contas");
  revalidatePath("/dashboard");
  return { ok: true };
}
