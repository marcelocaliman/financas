"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";
import { lookupAssetCNPJ } from "@/lib/financial/asset-catalog";

const ASSET_TYPES = [
  "fii",
  "fixed_income_public",
  "fixed_income_private",
  "stock",
  "etf",
  "crypto",
  "option",
  "pgbl",
  "vgbl",
] as const;
const INDEXERS = ["selic", "cdi", "ipca", "fixed", "none"] as const;
const OPTION_TYPES = ["call", "put"] as const;
const OPTION_POSITIONS = ["covered", "naked", "long"] as const;

const createSchema = z.object({
  accountId: z.string().uuid(),
  ticker: z.string().min(1),
  name: z.string().min(1),
  assetType: z.enum(ASSET_TYPES),
  indexer: z.enum(INDEXERS).optional(),
  indexerMultiplier: z.coerce.number().optional(),
  fixedRate: z.coerce.number().optional(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  initialAmount: z.coerce.number().nonnegative(),
  currentBalance: z.coerce.number().nonnegative().optional(),
  taxRegime: z.enum(["regressive", "exempt"]).default("regressive"),
  // Lote inicial para ativos de mercado (FII/ação/ETF/cripto/opção)
  quantity: z.coerce.number().positive().optional(),
  unitPrice: z.coerce.number().nonnegative().optional(),
  // IR
  cnpj: z.string().optional().nullable(),
  isExterior: z.coerce.boolean().optional().default(false),
  // Couple attribution
  ownerFilerId: z.string().uuid().optional().nullable(),
  isParticular: z.coerce.boolean().optional().default(false),
  particularReason: z.enum(["pre_casamento", "heranca", "doacao", "sub_rogacao", "outros"]).optional().nullable(),
  ownershipPercent: z.coerce.number().min(0).max(100).optional().nullable(),
  // Opção
  optionType: z.enum(OPTION_TYPES).optional().nullable(),
  strikePrice: z.coerce.number().positive().optional().nullable(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  underlyingTicker: z.string().optional().nullable(),
  optionPosition: z.enum(OPTION_POSITIONS).optional().nullable(),
});

const updateSchema = createSchema.extend({ id: z.string().uuid() });

export type InvestmentFormState = {
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

export async function createInvestment(
  _prev: InvestmentFormState | undefined,
  formData: FormData,
): Promise<InvestmentFormState> {
  const parsed = createSchema.safeParse({
    accountId: formData.get("accountId"),
    ticker: formData.get("ticker"),
    name: formData.get("name"),
    assetType: formData.get("assetType"),
    indexer: formData.get("indexer") || undefined,
    indexerMultiplier: formData.get("indexerMultiplier") || undefined,
    fixedRate: formData.get("fixedRate") || undefined,
    purchaseDate: formData.get("purchaseDate"),
    initialAmount: formData.get("initialAmount"),
    currentBalance: formData.get("currentBalance") || undefined,
    taxRegime: formData.get("taxRegime") || "regressive",
    quantity: formData.get("quantity") || undefined,
    unitPrice: formData.get("unitPrice") || undefined,
    cnpj: formData.get("cnpj") || null,
    isExterior: formData.get("isExterior") === "1" || formData.get("isExterior") === "true",
    ownerFilerId: formData.get("ownerFilerId") || null,
    isParticular: formData.get("isParticular") === "1" || formData.get("isParticular") === "true",
    particularReason: formData.get("particularReason") || null,
    ownershipPercent: formData.get("ownershipPercent") || null,
    optionType: formData.get("optionType") || null,
    strikePrice: formData.get("strikePrice") || null,
    expiryDate: formData.get("expiryDate") || null,
    underlyingTicker: formData.get("underlyingTicker") || null,
    optionPosition: formData.get("optionPosition") || null,
  });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const isMarketable = ["fii", "stock", "etf", "crypto", "option"].includes(parsed.data.assetType);
  if (isMarketable && (!parsed.data.quantity || parsed.data.quantity <= 0)) {
    return {
      fieldErrors: { quantity: "Para ativos de mercado informe a quantidade." },
    };
  }
  if (parsed.data.assetType === "option") {
    if (!parsed.data.optionType) {
      return { fieldErrors: { optionType: "Call ou Put obrigatório." } };
    }
    if (!parsed.data.strikePrice) {
      return { fieldErrors: { strikePrice: "Strike obrigatório." } };
    }
    if (!parsed.data.expiryDate) {
      return { fieldErrors: { expiryDate: "Vencimento obrigatório." } };
    }
    if (!parsed.data.optionPosition) {
      return { fieldErrors: { optionPosition: "Posição (lançada/comprada) obrigatória." } };
    }
  }

  const supabase = await createClient();

  // Investimento herda a moeda da conta. Mantém consistência sem expor
  // um campo extra no form (decisão UX: a corretora é "onde mora o dinheiro").
  const { data: acc } = await supabase
    .from("accounts")
    .select("currency")
    .eq("id", parsed.data.accountId)
    .maybeSingle();
  const investmentCurrency = (acc?.currency ?? "BRL") as "BRL" | "EUR" | "USD";

  // Fallback: se o form não mandou CNPJ mas é ticker conhecido, pega do catálogo.
  const cnpjResolved =
    parsed.data.cnpj?.replace(/\D/g, "") ||
    lookupAssetCNPJ(parsed.data.ticker)?.replace(/\D/g, "") ||
    null;

  const { data: created, error } = await supabase
    .from("investments")
    .insert({
      household_id: ctx.household.id,
      account_id: parsed.data.accountId,
      ticker: parsed.data.ticker.trim(),
      name: parsed.data.name.trim(),
      asset_type: parsed.data.assetType,
      indexer: parsed.data.indexer ?? null,
      indexer_multiplier: parsed.data.indexerMultiplier ?? null,
      fixed_rate: parsed.data.fixedRate ?? null,
      purchase_date: parsed.data.purchaseDate,
      initial_amount: parsed.data.initialAmount,
      current_balance: parsed.data.currentBalance ?? parsed.data.initialAmount,
      currency: investmentCurrency,
      tax_regime: parsed.data.taxRegime,
      cnpj: cnpjResolved,
      is_exterior: parsed.data.isExterior ?? false,
      option_type: parsed.data.optionType ?? null,
      strike_price: parsed.data.strikePrice ?? null,
      expiry_date: parsed.data.expiryDate ?? null,
      underlying_ticker: parsed.data.underlyingTicker?.trim() || null,
      option_position: parsed.data.optionPosition ?? null,
      owner_filer_id: parsed.data.ownerFilerId || null,
      is_particular: parsed.data.isParticular ?? false,
      particular_reason: parsed.data.particularReason ?? null,
      ownership_percent: parsed.data.ownershipPercent ?? null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  // Lote inicial dispara trigger que recalcula investments.quantity + initial_amount
  if (isMarketable && created && parsed.data.quantity && parsed.data.unitPrice != null) {
    const { error: mvErr } = await supabase.rpc("add_investment_movement", {
      p_investment_id: created.id,
      p_kind: "buy",
      p_date: parsed.data.purchaseDate,
      p_quantity: parsed.data.quantity,
      p_unit_price: parsed.data.unitPrice,
      p_fees: 0,
      p_notes: "Lote inicial (cadastro)",
    });
    if (mvErr) {
      return { ok: true, error: `Ativo criado, mas falhou ao gravar lote: ${mvErr.message}` };
    }
  }

  // Auto-débito da conta da corretora — evita dupla contagem ao calcular
  // patrimônio. Default ligado; o user pode desligar no form.
  const debitFromAccount = formData.get("debitFromAccount") === "1";
  const debitAmount = isMarketable
    ? (parsed.data.quantity ?? 0) * (parsed.data.unitPrice ?? 0)
    : parsed.data.initialAmount;
  if (debitFromAccount && created && debitAmount > 0) {
    const { error: txErr } = await supabase.from("transactions").insert({
      household_id: ctx.household.id,
      account_id: parsed.data.accountId,
      kind: "expense",
      amount: debitAmount,
      amount_account: debitAmount,
      currency: investmentCurrency,
      description: `Aplicação · ${parsed.data.ticker.trim()}`,
      date: parsed.data.purchaseDate,
      created_by: ctx.profile.id,
      category_source: "manual",
      metadata: { auto: true, investment_id: created.id },
    });
    if (txErr) {
      return {
        ok: true,
        error: `Ativo criado, mas o auto-débito falhou: ${txErr.message}`,
      };
    }
  }

  revalidatePath("/investimentos");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateInvestment(
  _prev: InvestmentFormState | undefined,
  formData: FormData,
): Promise<InvestmentFormState> {
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    accountId: formData.get("accountId"),
    ticker: formData.get("ticker"),
    name: formData.get("name"),
    assetType: formData.get("assetType"),
    indexer: formData.get("indexer") || undefined,
    indexerMultiplier: formData.get("indexerMultiplier") || undefined,
    fixedRate: formData.get("fixedRate") || undefined,
    purchaseDate: formData.get("purchaseDate"),
    initialAmount: formData.get("initialAmount"),
    currentBalance: formData.get("currentBalance") || undefined,
    taxRegime: formData.get("taxRegime") || "regressive",
    cnpj: formData.get("cnpj") || null,
    isExterior: formData.get("isExterior") === "1" || formData.get("isExterior") === "true",
    ownerFilerId: formData.get("ownerFilerId") || null,
    isParticular: formData.get("isParticular") === "1" || formData.get("isParticular") === "true",
    particularReason: formData.get("particularReason") || null,
    ownershipPercent: formData.get("ownershipPercent") || null,
    optionType: formData.get("optionType") || null,
    strikePrice: formData.get("strikePrice") || null,
    expiryDate: formData.get("expiryDate") || null,
    underlyingTicker: formData.get("underlyingTicker") || null,
    optionPosition: formData.get("optionPosition") || null,
  });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const supabase = await createClient();
  const cnpjResolved =
    parsed.data.cnpj?.replace(/\D/g, "") ||
    lookupAssetCNPJ(parsed.data.ticker)?.replace(/\D/g, "") ||
    null;
  const { error } = await supabase
    .from("investments")
    .update({
      account_id: parsed.data.accountId,
      ticker: parsed.data.ticker.trim(),
      name: parsed.data.name.trim(),
      asset_type: parsed.data.assetType,
      indexer: parsed.data.indexer ?? null,
      indexer_multiplier: parsed.data.indexerMultiplier ?? null,
      fixed_rate: parsed.data.fixedRate ?? null,
      purchase_date: parsed.data.purchaseDate,
      initial_amount: parsed.data.initialAmount,
      current_balance: parsed.data.currentBalance ?? parsed.data.initialAmount,
      tax_regime: parsed.data.taxRegime,
      cnpj: cnpjResolved,
      is_exterior: parsed.data.isExterior ?? false,
      option_type: parsed.data.optionType ?? null,
      strike_price: parsed.data.strikePrice ?? null,
      expiry_date: parsed.data.expiryDate ?? null,
      underlying_ticker: parsed.data.underlyingTicker?.trim() || null,
      option_position: parsed.data.optionPosition ?? null,
      owner_filer_id: parsed.data.ownerFilerId || null,
      is_particular: parsed.data.isParticular ?? false,
      particular_reason: parsed.data.particularReason ?? null,
      ownership_percent: parsed.data.ownershipPercent ?? null,
    })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };
  revalidatePath("/investimentos");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Sincroniza o saldo de um ativo de RF com o valor real vindo do broker
 * (Tesouro Direto, app do banco, etc). Override direto pra eliminar drift
 * acumulado por cálculo automático.
 *
 *   - current_balance = valor informado (truth-source = broker)
 *   - last_yield_at = hoje (sem yield futuro em cima imediatamente)
 *   - purchase_date opcionalmente atualizado pra data REAL de compra
 *
 * A partir daí, o cron diário aplica Selic em cima desse baseline.
 */
const syncBrokerSchema = z.object({
  id: z.string().uuid(),
  currentBalance: z.coerce.number().nonnegative(),
  purchaseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
});

export async function syncBrokerBalance(
  _prev: { ok?: boolean; error?: string } | undefined,
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  const parsed = syncBrokerSchema.safeParse({
    id: formData.get("id"),
    currentBalance: formData.get("currentBalance"),
    purchaseDate: formData.get("purchaseDate") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Auth required" };

  const supabase = await createClient();
  const todayIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const update: {
    current_balance: number;
    last_yield_at: string;
    purchase_date?: string;
  } = {
    current_balance: Math.round(parsed.data.currentBalance * 100) / 100,
    last_yield_at: todayIso,
  };
  if (parsed.data.purchaseDate) update.purchase_date = parsed.data.purchaseDate;

  const { error } = await supabase
    .from("investments")
    .update(update)
    .eq("id", parsed.data.id)
    .eq("household_id", ctx.household.id);
  if (error) return { error: error.message };

  revalidatePath("/investimentos");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function archiveInvestment(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("investments")
    .update({ is_active: false })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/investimentos");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function restoreInvestment(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("investments")
    .update({ is_active: true })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/investimentos");
  return { ok: true };
}

/**
 * Liquida um investment: registra venda + IR retido + opcionalmente lança caixa
 * na conta destino. Tudo atômico via RPC liquidate_investment.
 *
 * Use pra: venda antes do vencimento (reason='sold'), vencimento natural
 * ('matured'), ou encerramento sem dinheiro/sem venda formal ('archived').
 */
const liquidateSchema = z.object({
  investmentId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  grossProceeds: z.coerce.number().nonnegative(),
  irWithheld: z.coerce.number().nonnegative().default(0),
  destinationAccountId: z.string().uuid().optional().nullable(),
  reason: z.enum(["sold", "matured", "archived"]).default("sold"),
  notes: z.string().optional().nullable(),
});

export async function liquidateInvestment(
  input: z.input<typeof liquidateSchema>,
): Promise<{ ok?: boolean; error?: string; movementId?: string }> {
  const parsed = liquidateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("liquidate_investment", {
    p_investment_id: parsed.data.investmentId,
    p_date: parsed.data.date,
    p_gross_proceeds: parsed.data.grossProceeds,
    p_ir_withheld: parsed.data.irWithheld,
    p_destination_account_id: parsed.data.destinationAccountId ?? undefined,
    p_reason: parsed.data.reason,
    p_notes: parsed.data.notes ?? undefined,
  });
  if (error) return { error: error.message };
  for (const p of ["/investimentos", "/dashboard", "/transacoes", "/resgates"]) {
    revalidatePath(p);
  }
  return { ok: true, movementId: data as string };
}

/**
 * Reabre um investment liquidado por engano. Apaga movement sell, tx de caixa
 * e zera os campos closed_*. Saldo da conta destino é revertido.
 */
export async function reopenInvestment(
  investmentId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reopen_investment", {
    p_investment_id: investmentId,
  });
  if (error) return { error: error.message };
  for (const p of ["/investimentos", "/dashboard", "/transacoes"]) {
    revalidatePath(p);
  }
  return { ok: true };
}

/**
 * Deleta o ativo + rendimentos mensais (cascade) + regras de saque (cascade).
 * Atenção: irreversível.
 */
export async function deleteInvestment(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("investments").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/investimentos");
  revalidatePath("/resgates");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteMonthlyYield(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("investment_yields").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/investimentos");
  return { ok: true };
}

export async function recordMonthlyYield(formData: FormData) {
  const investmentId = String(formData.get("investmentId"));
  const month = String(formData.get("month"));
  const grossYield = Number(formData.get("grossYield") ?? 0);
  const tax = Number(formData.get("tax") ?? 0);

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };
  const supabase = await createClient();
  const { error } = await supabase.from("investment_yields").upsert(
    {
      investment_id: investmentId,
      household_id: ctx.household.id,
      month,
      gross_yield: grossYield,
      tax,
      source: "manual",
    },
    { onConflict: "investment_id,month" },
  );
  if (error) return { error: error.message };
  revalidatePath("/investimentos");
  return { ok: true };
}
