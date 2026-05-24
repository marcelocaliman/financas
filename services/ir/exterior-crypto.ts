import "server-only";
import { createClient } from "@/lib/supabase/server";
import { convertOrSame } from "@/lib/financial/currency";
import { getRateMapAt } from "@/services/currency";
import type { Currency } from "@/types/database";

/**
 * Lei 14.754/2023 — tributação anual única de 15% sobre LUCROS em
 * aplicações financeiras NO EXTERIOR (corretoras estrangeiras tipo
 * Avenue, IBKR, etc.) e CRIPTO.
 *
 * Regras-chave:
 *  - Aplicação anual fixa de 15% sobre LUCRO total (sem progressividade)
 *  - SEM isenção de R$ 35k/mês — passou a ser anual desde 2024
 *  - Variação cambial entra no cálculo (você vendeu em USD por X, valor
 *    em BRL depende do câmbio no momento da venda)
 *  - Prejuízo do ano-base é compensável dentro do mesmo "bolso"
 *  - Não tem mensalidade DARF — paga TUDO na declaração anual
 */

export type ExteriorReport = {
  year: number;
  /** Por ativo: lucro/prejuízo do ano */
  byAsset: Array<{
    investmentId: string;
    ticker: string;
    name: string;
    currency: Currency;
    /** Compras do ano em BRL no câmbio do dia da compra */
    totalBoughtBRL: number;
    /** Vendas do ano em BRL no câmbio do dia da venda */
    totalSoldBRL: number;
    profitBRL: number;
  }>;
  /** Variação cambial do ano: comparação entre saldos em 01/01 vs 31/12 */
  fxVariation: number;
  totalProfitBRL: number;
  carryforwardUsed: number;
  taxableBase: number;
  taxRate: number;
  taxDue: number;
};

const EXTERIOR_RATE = 0.15;

export async function getExteriorReport(
  year: number,
  householdId?: string,
): Promise<ExteriorReport> {
  const supabase = await createClient();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  void yearStart;

  // Movimentos do ano em ativos exterior
  let movQuery = supabase
    .from("investment_movements")
    .select(
      "date, kind, quantity, unit_price, total_amount, fees, investment:investments(id, ticker, name, asset_type, currency, is_exterior)",
    )
    .gte("date", `${year}-01-01`)
    .lte("date", yearEnd);
  if (householdId) movQuery = movQuery.eq("household_id", householdId);
  const { data: movements } = await movQuery;

  // Carryforward de exterior
  let cfQuery = supabase
    .from("ir_loss_carryforward")
    .select("balance, last_updated_year")
    .eq("kind", "exterior");
  if (householdId) cfQuery = cfQuery.eq("household_id", householdId);
  const { data: cfRow } = await cfQuery.maybeSingle();

  const carryforwardAvailable =
    cfRow && (cfRow.last_updated_year ?? 0) < year ? Number(cfRow.balance) : 0;

  type MovRow = {
    date: string;
    kind: string;
    quantity: number;
    unit_price: number;
    total_amount: number;
    fees: number;
    investment:
      | { id: string; ticker: string; name: string; asset_type: string; currency: Currency; is_exterior: boolean }
      | { id: string; ticker: string; name: string; asset_type: string; currency: Currency; is_exterior: boolean }[]
      | null;
  };

  // Cache de rates por data
  const rateCache = new Map<string, Awaited<ReturnType<typeof getRateMapAt>>>();
  async function ratesAt(date: string) {
    if (!rateCache.has(date)) rateCache.set(date, await getRateMapAt(date));
    return rateCache.get(date)!;
  }

  const byAsset = new Map<string, {
    investmentId: string;
    ticker: string;
    name: string;
    currency: Currency;
    totalBoughtBRL: number;
    totalSoldBRL: number;
    qty: number;
    totalCost: number;
  }>();

  for (const m of (movements ?? []) as MovRow[]) {
    const inv = Array.isArray(m.investment) ? m.investment[0] : m.investment;
    if (!inv || !inv.is_exterior) continue;
    const rates = await ratesAt(m.date);
    const totalBRL = convertOrSame(Number(m.total_amount), inv.currency, "BRL", rates);
    const feesBRL = convertOrSame(Number(m.fees ?? 0), inv.currency, "BRL", rates);

    const e = byAsset.get(inv.id) ?? {
      investmentId: inv.id,
      ticker: inv.ticker,
      name: inv.name,
      currency: inv.currency,
      totalBoughtBRL: 0,
      totalSoldBRL: 0,
      qty: 0,
      totalCost: 0,
    };

    if (m.kind === "buy") {
      e.totalBoughtBRL += totalBRL + feesBRL;
      e.qty += Number(m.quantity);
      e.totalCost += totalBRL + feesBRL;
    } else if (m.kind === "sell") {
      e.totalSoldBRL += totalBRL - feesBRL;
      // Reduz custo proporcional
      const sellQty = Number(m.quantity);
      if (e.qty > 0) {
        e.totalCost -= (e.totalCost / e.qty) * sellQty;
      }
      e.qty -= sellQty;
    }
    byAsset.set(inv.id, e);
  }

  const assets = Array.from(byAsset.values()).map((a) => ({
    investmentId: a.investmentId,
    ticker: a.ticker,
    name: a.name,
    currency: a.currency,
    totalBoughtBRL: Math.round(a.totalBoughtBRL * 100) / 100,
    totalSoldBRL: Math.round(a.totalSoldBRL * 100) / 100,
    profitBRL: Math.round((a.totalSoldBRL - (a.totalBoughtBRL - a.totalCost)) * 100) / 100,
  }));

  const totalProfit = assets.reduce((s, a) => s + a.profitBRL, 0);
  const carryforwardUsed = Math.min(carryforwardAvailable, Math.max(0, totalProfit));
  const taxableBase = Math.max(0, totalProfit - carryforwardUsed);
  const taxDue = taxableBase * EXTERIOR_RATE;

  const round2 = (n: number) => Math.round(n * 100) / 100;

  return {
    year,
    byAsset: assets,
    fxVariation: 0, // TODO: snapshot inicial vs final
    totalProfitBRL: round2(totalProfit),
    carryforwardUsed: round2(carryforwardUsed),
    taxableBase: round2(taxableBase),
    taxRate: EXTERIOR_RATE,
    taxDue: round2(taxDue),
  };
}

/**
 * Cripto: vendas até R$ 35k/mês isentas (regime ainda separado do exterior).
 * Acima: 15% até R$ 5MM, escalonando até 22.5% acima de R$ 30MM.
 */
export type CryptoReport = {
  year: number;
  monthly: Array<{
    month: number;
    grossSales: number;
    profit: number;
    isExempt: boolean;
    taxableBase: number;
    taxRate: number;
    taxDue: number;
  }>;
  totalTaxDue: number;
};

const CRYPTO_EXEMPTION = 35000;

export async function getCryptoReport(
  year: number,
  householdId?: string,
): Promise<CryptoReport> {
  const supabase = await createClient();
  const yearEnd = `${year}-12-31`;
  const rates = await getRateMapAt(yearEnd);

  let q = supabase
    .from("investment_movements")
    .select(
      "date, kind, quantity, unit_price, total_amount, fees, investment:investments(id, ticker, asset_type, currency, is_exterior)",
    )
    .gte("date", `${year}-01-01`)
    .lte("date", yearEnd);
  if (householdId) q = q.eq("household_id", householdId);
  const { data: movs } = await q;

  type MovRow = {
    date: string;
    kind: string;
    quantity: number;
    unit_price: number;
    total_amount: number;
    fees: number;
    investment:
      | { id: string; ticker: string; asset_type: string; currency: Currency; is_exterior: boolean }
      | { id: string; ticker: string; asset_type: string; currency: Currency; is_exterior: boolean }[]
      | null;
  };

  // Tracking positions
  const positions = new Map<string, { qty: number; totalCost: number }>();
  const monthlyData: Array<{ grossSales: number; profit: number }> = Array.from(
    { length: 12 }, () => ({ grossSales: 0, profit: 0 }),
  );

  for (const m of (movs ?? []) as MovRow[]) {
    const inv = Array.isArray(m.investment) ? m.investment[0] : m.investment;
    if (!inv) continue;
    if (inv.asset_type !== "crypto") continue;
    if (inv.is_exterior) continue; // exterior tem regime próprio

    const month = parseInt(m.date.slice(5, 7), 10) - 1;
    const totalBRL = convertOrSame(Number(m.total_amount), inv.currency, "BRL", rates);
    const feesBRL = convertOrSame(Number(m.fees ?? 0), inv.currency, "BRL", rates);
    const qty = Number(m.quantity);
    const pos = positions.get(inv.id) ?? { qty: 0, totalCost: 0 };

    if (m.kind === "buy") {
      pos.qty += qty;
      pos.totalCost += totalBRL + feesBRL;
      positions.set(inv.id, pos);
    } else if (m.kind === "sell") {
      const avgCost = pos.qty > 0 ? pos.totalCost / pos.qty : 0;
      const costBasis = avgCost * qty;
      const grossSale = totalBRL - feesBRL;
      monthlyData[month].grossSales += grossSale;
      monthlyData[month].profit += grossSale - costBasis;
      pos.totalCost -= costBasis;
      pos.qty -= qty;
      positions.set(inv.id, pos);
    }
  }

  let totalTaxDue = 0;
  const monthly = monthlyData.map((d, i) => {
    const isExempt = d.grossSales <= CRYPTO_EXEMPTION;
    let taxRate = 0;
    let taxableBase = 0;
    let taxDue = 0;
    if (!isExempt && d.profit > 0) {
      taxableBase = d.profit;
      // Faixas progressivas — pra MVP, 15% (cobre 95% dos casos)
      taxRate = 0.15;
      taxDue = taxableBase * taxRate;
      totalTaxDue += taxDue;
    }
    return {
      month: i + 1,
      grossSales: Math.round(d.grossSales * 100) / 100,
      profit: Math.round(d.profit * 100) / 100,
      isExempt,
      taxableBase: Math.round(taxableBase * 100) / 100,
      taxRate,
      taxDue: Math.round(taxDue * 100) / 100,
    };
  });

  return {
    year,
    monthly,
    totalTaxDue: Math.round(totalTaxDue * 100) / 100,
  };
}
