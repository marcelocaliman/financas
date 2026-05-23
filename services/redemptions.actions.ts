"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";
import { getLivePortfolio } from "@/services/live-yield";

const ruleSchema = z.object({
  investmentId: z.string().uuid(),
  destinationAccountId: z.string().uuid(),
  mode: z.enum(["reinvest", "fixed_amount", "percentage"]),
  suggestedAmount: z.coerce.number().optional(),
  percentage: z.coerce.number().optional(),
  dayOfMonth: z.coerce.number().int().min(1).max(31),
  notes: z.string().optional(),
});

const updateRuleSchema = ruleSchema.extend({ id: z.string().uuid() });

export type RuleFormState = {
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

export async function createYieldRule(
  _prev: RuleFormState | undefined,
  formData: FormData,
): Promise<RuleFormState> {
  const parsed = ruleSchema.safeParse({
    investmentId: formData.get("investmentId"),
    destinationAccountId: formData.get("destinationAccountId"),
    mode: formData.get("mode"),
    suggestedAmount: formData.get("suggestedAmount") || undefined,
    percentage: formData.get("percentage") || undefined,
    dayOfMonth: formData.get("dayOfMonth"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { error } = await supabase.from("yield_rules").insert({
    household_id: ctx.household.id,
    investment_id: parsed.data.investmentId,
    destination_account_id: parsed.data.destinationAccountId,
    mode: parsed.data.mode,
    suggested_amount: parsed.data.suggestedAmount ?? null,
    percentage: parsed.data.percentage ?? null,
    day_of_month: parsed.data.dayOfMonth,
    notes: parsed.data.notes ?? null,
  });
  if (error) return { error: error.message };

  await supabase.rpc("ensure_pending_intents", { p_months_ahead: 3 });
  revalidatePath("/resgates");
  return { ok: true };
}

export async function updateYieldRule(
  _prev: RuleFormState | undefined,
  formData: FormData,
): Promise<RuleFormState> {
  const parsed = updateRuleSchema.safeParse({
    id: formData.get("id"),
    investmentId: formData.get("investmentId"),
    destinationAccountId: formData.get("destinationAccountId"),
    mode: formData.get("mode"),
    suggestedAmount: formData.get("suggestedAmount") || undefined,
    percentage: formData.get("percentage") || undefined,
    dayOfMonth: formData.get("dayOfMonth"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("yield_rules")
    .update({
      investment_id: parsed.data.investmentId,
      destination_account_id: parsed.data.destinationAccountId,
      mode: parsed.data.mode,
      suggested_amount: parsed.data.suggestedAmount ?? null,
      percentage: parsed.data.percentage ?? null,
      day_of_month: parsed.data.dayOfMonth,
      notes: parsed.data.notes ?? null,
    })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };
  revalidatePath("/resgates");
  return { ok: true };
}

export async function archiveYieldRule(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("yield_rules").update({ is_active: false }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/resgates");
  return { ok: true };
}

export async function restoreYieldRule(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("yield_rules").update({ is_active: true }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/resgates");
  return { ok: true };
}

/**
 * Deleta a regra. Intents pendentes ou finalizados associados são apagados
 * em cascata (via FK). Saques já executados continuam existindo como
 * transactions (transfer_pair_id) — não são afetados.
 */
export async function deleteYieldRule(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("yield_rules").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/resgates");
  return { ok: true };
}

export async function executeRedemption(intentId: string, amount: number) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("execute_redemption", {
    p_intent_id: intentId,
    p_amount: amount,
  });
  if (error) return { error: error.message };
  revalidatePath("/resgates");
  revalidatePath("/dashboard");
  revalidatePath("/investimentos");
  revalidatePath("/transacoes");
  return { ok: true };
}

export async function skipRedemption(intentId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("skip_redemption", { p_intent_id: intentId });
  if (error) return { error: error.message };
  revalidatePath("/resgates");
  return { ok: true };
}

/* ========================================================================== *
 * Saque ad-hoc de rendimento
 *
 * Caso o user queira marcar que sacou um valor do yield SEM passar por uma
 * yield_rule formal — útil pra registro simples. Diminui o current_balance
 * do investimento e cria uma transação de income na conta destino com
 * metadata.yield_withdrawal = true (auditoria futura).
 * ========================================================================== */

const withdrawYieldSchema = z.object({
  investmentId: z.string().uuid(),
  targetAccountId: z.string().uuid(),
  amount: z.coerce.number().positive("Valor precisa ser positivo."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  notes: z.string().optional(),
});

export type WithdrawYieldState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  /**
   * Quanto saiu do rendimento acumulado e quanto invadiu o principal.
   * Quando invadedPrincipal > 0, a UI mostra aviso pra confirmar a "comida"
   * do principal — vide WithdrawYieldDialog.
   */
  fromYield?: number;
  invadedPrincipal?: number;
};

/**
 * Saca dinheiro de um ativo de renda fixa com REGRA YIELD-FIRST → PRINCIPAL.
 *
 * Lógica:
 *  1. Calcula o saldo DERIVADO ao vivo (composição contínua até now)
 *  2. yield_disponivel = derived − initial_amount
 *  3. Se amount ≤ yield_disponivel: só "come" do yield
 *     - new_current_balance = derived − amount
 *     - initial_amount intacto
 *  4. Se amount > yield_disponivel: come tudo o yield + invade principal
 *     - invade = amount − yield_disponivel
 *     - new_current_balance = derived − amount
 *     - new_initial_amount = initial_amount − invade
 *  5. last_yield_at = today (zera o "histórico de composição" pra evitar
 *     re-compor a partir de referência antiga após o update)
 *  6. Cria transaction de income na conta destino com metadata pra auditoria
 */
export async function withdrawYield(
  _prev: WithdrawYieldState | undefined,
  formData: FormData,
): Promise<WithdrawYieldState> {
  const parsed = withdrawYieldSchema.safeParse({
    investmentId: formData.get("investmentId"),
    targetAccountId: formData.get("targetAccountId"),
    amount: formData.get("amount"),
    date: formData.get("date"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();

  // 1. Carrega investimento + conta destino (pra validações + currency)
  const [{ data: inv }, { data: acc }] = await Promise.all([
    supabase
      .from("investments")
      .select(
        "id, ticker, name, current_balance, initial_amount, currency, household_id",
      )
      .eq("id", parsed.data.investmentId)
      .maybeSingle(),
    supabase
      .from("accounts")
      .select("id, name, currency, household_id")
      .eq("id", parsed.data.targetAccountId)
      .maybeSingle(),
  ]);

  if (!inv) return { error: "Investimento não encontrado." };
  if (!acc) return { error: "Conta destino não encontrada." };
  if (inv.household_id !== ctx.household.id || acc.household_id !== ctx.household.id) {
    return { error: "Acesso negado." };
  }

  // 2. Pega o saldo DERIVADO ao vivo (composição contínua até agora) e o
  //    accumulatedYield (lifetime) do live portfolio. Cache por request.
  const live = await getLivePortfolio();
  const liveAsset = live.byAsset.find((a) => a.id === inv.id);

  const derivedBalance = liveAsset?.baseBalance ?? Number(inv.current_balance);
  const accumulatedYield = Math.max(0, liveAsset?.accumulatedYield ?? 0);
  const initialAmount = Number(inv.initial_amount);
  const amount = parsed.data.amount;

  // 3. Validação: não permite sacar mais do que o saldo derivado total
  if (amount > derivedBalance + 0.005) {
    return {
      error: `Valor maior que o saldo do ativo (R$ ${derivedBalance.toFixed(2)}).`,
    };
  }

  // 4. Cascading yield-first → principal
  const fromYield = Math.min(amount, accumulatedYield);
  const invadedPrincipal = Math.max(0, amount - accumulatedYield);
  const newCurrentBalance = derivedBalance - amount;
  const newInitialAmount = initialAmount - invadedPrincipal;

  // 5. Update investimento com snapshot novo e last_yield_at = hoje
  //    (last_yield_at resetado pra evitar re-composição a partir de ref antiga)
  const today = new Date().toISOString().slice(0, 10);
  const { error: invErr } = await supabase
    .from("investments")
    .update({
      current_balance: Math.round(newCurrentBalance * 100) / 100,
      initial_amount: Math.round(newInitialAmount * 100) / 100,
      last_yield_at: today,
    })
    .eq("id", inv.id);
  if (invErr) return { error: invErr.message };

  // 6. Cria transação de income na conta destino
  const { error: txErr } = await supabase.from("transactions").insert({
    household_id: ctx.household.id,
    account_id: acc.id,
    kind: "income",
    amount,
    amount_account: amount,
    currency: acc.currency,
    description:
      invadedPrincipal > 0
        ? `Saque · ${inv.ticker}`
        : `Saque de rendimento · ${inv.ticker}`,
    date: parsed.data.date,
    created_by: ctx.profile.id,
    category_source: "manual",
    metadata: {
      yield_withdrawal: true,
      investment_id: inv.id,
      investment_ticker: inv.ticker,
      from_yield: Math.round(fromYield * 100) / 100,
      invaded_principal: Math.round(invadedPrincipal * 100) / 100,
      notes: parsed.data.notes?.trim() ?? null,
    },
  });
  if (txErr) {
    // Rollback completo se a transação falhou
    await supabase
      .from("investments")
      .update({
        current_balance: Number(inv.current_balance),
        initial_amount: initialAmount,
      })
      .eq("id", inv.id);
    return { error: txErr.message };
  }

  revalidatePath("/investimentos");
  revalidatePath("/dashboard");
  revalidatePath("/transacoes");
  revalidatePath("/contas");
  revalidatePath("/resgates");
  return {
    ok: true,
    fromYield: Math.round(fromYield * 100) / 100,
    invadedPrincipal: Math.round(invadedPrincipal * 100) / 100,
  };
}
