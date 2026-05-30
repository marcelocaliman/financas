"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";

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
  /** Parte do saque que representa rendimento (proporcional). */
  fromYield?: number;
  /** Parte do saque que representa principal (proporcional). */
  principalReduction?: number;
  /** True se o saque excede o rendimento acumulado (sinal de alerta). */
  exceededYield?: boolean;
  /** @deprecated alias mantido pra retrocompat — use principalReduction */
  invadedPrincipal?: number;
};

/**
 * Saca dinheiro de um ativo de renda fixa com REGRA PROPORCIONAL (TD-style).
 *
 * Modelo: trata o saque como venda parcial proporcional da posição. Mesma
 * matemática usada pelo Tesouro Direto e pela Receita Federal pra custo médio.
 *
 *   ratio = amount / current_balance         // fração da posição vendida
 *   new_balance = current_balance − amount
 *   new_initial = initial × (1 − ratio)      // custo reduzido proporcional
 *
 * Resultado: rentabilidade % é preservada após o saque
 *   (rendimento/custo permanece igual, refletindo que vendemos uma fatia).
 *
 * Pra reporting:
 *   fromYield = amount × (accumulatedYield / current_balance)
 *   principalReduction = amount × (initial / current_balance)
 *   exceededYield = amount > accumulatedYield (saque maior que ganhos)
 *
 *  - last_yield_at = today (zera composição pra evitar recompor de ref antiga)
 *  - Cria transaction de income na conta destino com metadata pra auditoria
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
        "id, ticker, name, current_balance, initial_amount, currency, household_id, last_yield_at",
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

  // 2. Saldo atual do ativo = current_balance no banco (atualizado
  //    manualmente pelo usuário).
  const currentBalance = Number(inv.current_balance);
  const initialAmount = Number(inv.initial_amount);
  const amount = parsed.data.amount;
  // accumulatedYield estimado: saldo atual - aplicado (se positivo)
  const accumulatedYield = Math.max(0, currentBalance - initialAmount);

  // 3. Validação: não permite sacar mais do que o saldo atual
  if (amount > currentBalance + 0.005) {
    return {
      error: `Valor maior que o saldo do ativo (R$ ${currentBalance.toFixed(2)}).`,
    };
  }

  // 4. Proporcional (TD-style): reduz custo na mesma fração da posição vendida
  const ratio = amount / currentBalance;
  const newCurrentBalance = currentBalance - amount;
  const newInitialAmount = initialAmount * (1 - ratio);
  // Breakdown do saque pra reporting/metadata (não afeta o cálculo).
  // principal = amount − fromYield garante que somem exatamente `amount` em
  // qualquer cenário, inclusive prejuízo (antes usava initialAmount/currentBalance,
  // que em prejuízo dava principal > amount, registro incoerente). Bate com o
  // preview do dialog (withdraw-yield-dialog).
  const fromYield = (accumulatedYield / currentBalance) * amount;
  const principalReduction = amount - fromYield;
  const exceededYield = amount > accumulatedYield;

  // 5. Update investimento com snapshot novo e last_yield_at = hoje
  //    (last_yield_at resetado pra evitar re-composição a partir de ref antiga)
  const prevLastYieldAt = inv.last_yield_at; // pra rollback restaurar
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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
    description: exceededYield
      ? `Saque · ${inv.ticker}`
      : `Saque de rendimento · ${inv.ticker}`,
    date: parsed.data.date,
    created_by: ctx.profile.id,
    category_source: "manual",
    metadata: {
      yield_withdrawal: true,
      investment_id: inv.id,
      investment_ticker: inv.ticker,
      sell_ratio: Math.round(ratio * 10000) / 100, // %
      from_yield: Math.round(fromYield * 100) / 100,
      principal_reduction: Math.round(principalReduction * 100) / 100,
      exceeded_yield: exceededYield,
      notes: parsed.data.notes?.trim() ?? null,
    },
  });
  if (txErr) {
    // Rollback completo se a transação falhou — inclui last_yield_at, senão
    // ficaria carimbado em "hoje" e a derivação live de rendimento (IR/patrimônio)
    // comporia a partir de uma referência tarde-demais, subestimando os dias.
    await supabase
      .from("investments")
      .update({
        current_balance: Number(inv.current_balance),
        initial_amount: initialAmount,
        last_yield_at: prevLastYieldAt,
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
    principalReduction: Math.round(principalReduction * 100) / 100,
    exceededYield,
    invadedPrincipal: Math.round(principalReduction * 100) / 100,
  };
}
