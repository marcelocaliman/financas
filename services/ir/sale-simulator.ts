import "server-only";
import { createClient } from "@/lib/supabase/server";
import { convertOrSame } from "@/lib/financial/currency";
import { getRateMapAt } from "@/services/currency";
import type { Currency } from "@/types/database";

/**
 * Simula uma venda antes de executar — útil pro usuário entender o
 * impacto fiscal antes de clicar "vender".
 */

export type SaleSimulation = {
  investmentId: string;
  ticker: string;
  qty: number;
  currentQty: number;
  averageCost: number;
  saleUnitPrice: number;
  grossSale: number;
  costBasis: number;
  profit: number;
  isProfit: boolean;
  isDayTrade: boolean;
  /** Soma das vendas do mês corrente (pra checar isenção 20k swing ações) */
  monthSalesSoFar: number;
  monthSalesAfterThis: number;
  willLoseExemption: boolean;
  exemptionApplied: boolean;
  /** Prejuízo acumulado disponível pra compensar */
  carryforwardAvailable: number;
  carryforwardWillUse: number;
  /** Base de cálculo após compensação */
  taxableBase: number;
  taxRate: number;
  /** IRRF retido na fonte (deduzido do DARF) */
  irrfWithheld: number;
  /** DARF a pagar */
  darfDue: number;
  darfDueDate: string;
  /** Avisos importantes pra mostrar ao usuário */
  warnings: string[];
};

const SWING_EXEMPTION = 20000;
const SWING_RATE = 0.15;
const DAY_TRADE_RATE = 0.20;
const FII_RATE = 0.20;
const OPTIONS_RATE = 0.15;
const SWING_IRRF = 0.00005;
const DAY_TRADE_IRRF = 0.01;

function lastBusinessDayOfNextMonth(year: number, month: number): string {
  let y = year;
  let m = month + 1;
  if (m > 12) { m = 1; y++; }
  const last = new Date(Date.UTC(y, m, 0));
  while (last.getUTCDay() === 0 || last.getUTCDay() === 6) {
    last.setUTCDate(last.getUTCDate() - 1);
  }
  return last.toISOString().slice(0, 10);
}

export async function simulateSale(args: {
  investmentId: string;
  qty: number;
  unitPrice: number;
  saleDate: string;
  isDayTrade?: boolean;
}): Promise<SaleSimulation | { error: string }> {
  const supabase = await createClient();

  const { data: inv } = await supabase
    .from("investments")
    .select("id, ticker, name, asset_type, quantity, initial_amount, currency")
    .eq("id", args.investmentId)
    .maybeSingle();
  if (!inv) return { error: "Investimento não encontrado." };

  const currentQty = Number(inv.quantity ?? 0);
  if (args.qty <= 0) return { error: "Quantidade inválida." };
  if (args.qty > currentQty) {
    return { error: `Quantidade insuficiente. Disponível: ${currentQty}` };
  }

  const initialAmount = Number(inv.initial_amount ?? 0);
  const averageCost = currentQty > 0 ? initialAmount / currentQty : 0;

  // Conversão BRL
  const rates = await getRateMapAt(args.saleDate);
  const unitPriceBRL = convertOrSame(
    args.unitPrice, inv.currency as Currency, "BRL", rates,
  );
  const avgCostBRL = convertOrSame(
    averageCost, inv.currency as Currency, "BRL", rates,
  );

  const grossSale = args.qty * unitPriceBRL;
  const costBasis = args.qty * avgCostBRL;
  const profit = grossSale - costBasis;

  // Vendas do mês corrente pra checar isenção
  const month = parseInt(args.saleDate.slice(5, 7), 10);
  const year = parseInt(args.saleDate.slice(0, 4), 10);
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-31`;

  const { data: monthMovs } = await supabase
    .from("investment_movements")
    .select("total_amount, fees, investment:investments(asset_type, currency, is_exterior)")
    .eq("kind", "sell")
    .gte("date", monthStart)
    .lte("date", monthEnd);

  // Soma vendas do mês de ATIVOS BR (não exterior) pra checar isenção
  let monthSalesSoFar = 0;
  type SaleMov = {
    total_amount: number;
    fees: number;
    investment:
      | { asset_type: string; currency: Currency; is_exterior: boolean }
      | { asset_type: string; currency: Currency; is_exterior: boolean }[]
      | null;
  };
  for (const m of (monthMovs ?? []) as SaleMov[]) {
    const i = Array.isArray(m.investment) ? m.investment[0] : m.investment;
    if (!i || i.is_exterior) continue;
    // Conta apenas vendas de ações comuns pra isenção R$ 20k
    if (i.asset_type === "stock") {
      const v = convertOrSame(
        Number(m.total_amount) - Number(m.fees ?? 0),
        i.currency, "BRL", rates,
      );
      monthSalesSoFar += v;
    }
  }
  const monthSalesAfterThis = monthSalesSoFar + grossSale;

  // Determina kind
  let kind: "swing" | "day_trade" | "fii" | "options";
  const isOption = inv.asset_type === "option";
  if (isOption) kind = "options";
  else if (inv.asset_type === "fii") kind = "fii";
  else if (args.isDayTrade) kind = "day_trade";
  else kind = "swing";

  // Exemption: apenas swing trade de AÇÕES, vendas mensais ≤ R$ 20k
  const exemptionApplied =
    kind === "swing" &&
    inv.asset_type === "stock" &&
    monthSalesAfterThis <= SWING_EXEMPTION;
  const willLoseExemption =
    kind === "swing" &&
    inv.asset_type === "stock" &&
    monthSalesSoFar <= SWING_EXEMPTION &&
    monthSalesAfterThis > SWING_EXEMPTION;

  // Carryforward
  const { data: cf } = await supabase
    .from("ir_loss_carryforward")
    .select("balance")
    .eq("kind", kind)
    .maybeSingle();
  const carryforwardAvailable = Number(cf?.balance ?? 0);

  let taxableBase = 0;
  let carryforwardWillUse = 0;
  let irrfWithheld = 0;
  let darfDue = 0;
  let taxRate = 0;

  if (exemptionApplied) {
    // Isento, sem imposto
  } else if (profit > 0) {
    carryforwardWillUse = Math.min(carryforwardAvailable, profit);
    taxableBase = profit - carryforwardWillUse;
    taxRate =
      kind === "swing" ? SWING_RATE
      : kind === "day_trade" ? DAY_TRADE_RATE
      : kind === "fii" ? FII_RATE
      : kind === "options" ? OPTIONS_RATE
      : SWING_RATE;
    const grossTax = taxableBase * taxRate;
    irrfWithheld =
      kind === "day_trade"
        ? profit * DAY_TRADE_IRRF
        : grossSale * SWING_IRRF;
    darfDue = Math.max(0, grossTax - irrfWithheld);
  }

  const warnings: string[] = [];
  if (willLoseExemption) {
    warnings.push(
      `Essa venda ultrapassa o limite de R$ 20.000/mês — perde a isenção do swing trade de ações. Considere vender em outro mês.`,
    );
  }
  if (kind === "options") {
    warnings.push("Opções NÃO têm isenção de R$ 20k/mês.");
  }
  if (profit < 0) {
    warnings.push(
      `Prejuízo de R$ ${Math.abs(profit).toFixed(2)} vai aumentar seu carryforward de ${kind} pra compensar lucros futuros.`,
    );
  }
  if (carryforwardWillUse > 0) {
    warnings.push(
      `Vai usar R$ ${carryforwardWillUse.toFixed(2)} do seu carryforward acumulado.`,
    );
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;

  return {
    investmentId: inv.id,
    ticker: inv.ticker,
    qty: args.qty,
    currentQty,
    averageCost: round2(avgCostBRL),
    saleUnitPrice: round2(unitPriceBRL),
    grossSale: round2(grossSale),
    costBasis: round2(costBasis),
    profit: round2(profit),
    isProfit: profit > 0,
    isDayTrade: !!args.isDayTrade,
    monthSalesSoFar: round2(monthSalesSoFar),
    monthSalesAfterThis: round2(monthSalesAfterThis),
    willLoseExemption,
    exemptionApplied,
    carryforwardAvailable: round2(carryforwardAvailable),
    carryforwardWillUse: round2(carryforwardWillUse),
    taxableBase: round2(taxableBase),
    taxRate,
    irrfWithheld: round2(irrfWithheld),
    darfDue: round2(darfDue),
    darfDueDate: lastBusinessDayOfNextMonth(year, month),
    warnings,
  };
}
