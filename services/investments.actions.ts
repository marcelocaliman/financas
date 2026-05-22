"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";

const ASSET_TYPES = [
  "fii",
  "fixed_income_public",
  "fixed_income_private",
  "stock",
  "etf",
  "crypto",
] as const;
const INDEXERS = ["selic", "cdi", "ipca", "fixed", "none"] as const;

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
  // Lote inicial para ativos de mercado (FII/ação/ETF/cripto)
  quantity: z.coerce.number().positive().optional(),
  unitPrice: z.coerce.number().nonnegative().optional(),
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
  });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const isMarketable = ["fii", "stock", "etf", "crypto"].includes(parsed.data.assetType);
  if (isMarketable && (!parsed.data.quantity || parsed.data.quantity <= 0)) {
    return {
      fieldErrors: { quantity: "Para ações, FIIs, ETFs ou cripto informe a quantidade." },
    };
  }

  const supabase = await createClient();
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
      tax_regime: parsed.data.taxRegime,
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
  });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const supabase = await createClient();
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
    })
    .eq("id", parsed.data.id);
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
