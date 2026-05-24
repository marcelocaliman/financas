import "server-only";
import { createClient } from "@/lib/supabase/server";
import { convertOrSame } from "@/lib/financial/currency";
import { getRateMapAt } from "@/services/currency";
import type { Currency, IRDarfKind, Tables } from "@/types/database";

/**
 * Apuração mensal de renda variável e geração de DARFs.
 *
 * Regras Receita 2024+:
 *
 * SWING TRADE (operações comuns — compra e venda em datas diferentes):
 *   - Ações: ISENÇÃO se vendas totais do mês ≤ R$ 20.000
 *   - Acima da isenção, alíquota 15% sobre o lucro
 *   - IRRF na fonte: 0,005% sobre vendas (descontado do imposto a pagar)
 *   - Compensação de prejuízo ilimitada no tempo (mesmo tipo de operação)
 *
 * DAY TRADE (compra e venda no MESMO dia):
 *   - SEM isenção
 *   - Alíquota 20% sobre o lucro
 *   - IRRF na fonte: 1% sobre lucro (descontado)
 *   - Compensação separada de swing
 *
 * FII (Fundos Imobiliários):
 *   - Ganho de capital na venda de cotas → 20%, SEM isenção
 *   - Compensação separada
 *
 * Vencimento DARF (código 6015): último dia útil do mês SEGUINTE
 *   ex.: vendas de março/2026 → DARF vence em 30/04/2026
 */

// ============================================================================
// Cálculo de custo médio + lucro por venda
// ============================================================================
type Position = {
  qty: number;
  totalCost: number; // custo total (incluindo taxas)
};

type SaleResult = {
  date: string;
  ticker: string;
  assetType: string;
  qty: number;
  unitPrice: number;
  grossSale: number;
  costBasis: number;
  profit: number; // pode ser negativo
  isDayTrade: boolean;
};

export type DarfMonth = {
  year: number;
  month: number;
  kind: IRDarfKind;
  grossSales: number;
  grossProfit: number;
  monthlyLoss: number;
  carryforwardUsedThisMonth: number;
  carryforwardRemainingAfter: number;
  taxableBase: number;
  irrfRetained: number;
  taxDue: number;
  isExempt: boolean;
  dueDate: string; // último dia útil do mês seguinte
  sales: SaleResult[];
};

export type RendaVariavelReport = {
  year: number;
  swing: DarfMonth[];
  dayTrade: DarfMonth[];
  fii: DarfMonth[];
  finalCarryforward: {
    swing: number;
    day_trade: number;
    fii: number;
  };
  totals: {
    grossSalesYear: number;
    grossProfitYear: number;
    totalTaxDue: number;
    totalIRRF: number;
  };
};

const SWING_EXEMPTION_LIMIT = 20000; // R$ 20.000/mês
const SWING_RATE = 0.15;
const DAY_TRADE_RATE = 0.20;
const FII_RATE = 0.20;
const SWING_IRRF_RATE = 0.00005; // 0,005% sobre vendas
const DAY_TRADE_IRRF_RATE = 0.01; // 1% sobre o lucro

/**
 * Calcula o último dia útil do mês seguinte (vencimento DARF 6015).
 * "Útil" = não fim de semana. (Sem feriados nacionais aqui — usuário
 * antecipa pra dia anterior se precisar.)
 */
function lastBusinessDayOfNextMonth(year: number, month: number): string {
  // month é 1-12, vencimento é no mês seguinte
  let y = year;
  let m = month + 1;
  if (m > 12) { m = 1; y++; }
  const last = new Date(Date.UTC(y, m, 0)); // último dia do mês (m é 1-12, day=0 → último do anterior)
  // recua se sáb/dom
  while (last.getUTCDay() === 0 || last.getUTCDay() === 6) {
    last.setUTCDate(last.getUTCDate() - 1);
  }
  return last.toISOString().slice(0, 10);
}

export async function getRendaVariavelReport(
  year: number,
  householdId?: string,
): Promise<RendaVariavelReport> {
  const supabase = await createClient();

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const rates = await getRateMapAt(yearEnd);

  const mvQuery = supabase
    .from("investment_movements")
    .select("date, kind, quantity, unit_price, total_amount, fees, is_day_trade, investment:investments(id, ticker, asset_type, currency)")
    .lte("date", yearEnd);
  const cfQuery = supabase
    .from("ir_loss_carryforward")
    .select("kind, balance, last_updated_year");

  const [{ data: movements }, { data: carryforwards }] = await Promise.all([
    (householdId ? mvQuery.eq("household_id", householdId) : mvQuery).order("date", { ascending: true }),
    householdId ? cfQuery.eq("household_id", householdId) : cfQuery,
  ]);

  // Carryforward inicial (do FIM do ano anterior pro INÍCIO do ano corrente)
  const initialCarryforward: Record<IRDarfKind, number> = {
    swing: 0,
    day_trade: 0,
    fii: 0,
  };
  for (const c of carryforwards ?? []) {
    // Só conta se foi atualizado em ano <= year-1
    if ((c.last_updated_year ?? year) <= year - 1) {
      initialCarryforward[c.kind as IRDarfKind] = Number(c.balance ?? 0);
    }
  }

  // Posições por ativo (custo médio acumulado desde o INÍCIO da história)
  type MovementRow = {
    date: string;
    kind: string;
    quantity: number;
    unit_price: number;
    total_amount: number;
    fees: number;
    is_day_trade: boolean;
    investment:
      | { id: string; ticker: string; asset_type: string; currency: Currency }
      | { id: string; ticker: string; asset_type: string; currency: Currency }[]
      | null;
  };

  const positions = new Map<string, Position>();
  const salesByKind: Record<IRDarfKind, Map<number, SaleResult[]>> = {
    swing: new Map(),
    day_trade: new Map(),
    fii: new Map(),
  };

  // Inicializa mapas dos 12 meses
  for (const kind of ["swing", "day_trade", "fii"] as IRDarfKind[]) {
    for (let m = 1; m <= 12; m++) {
      salesByKind[kind].set(m, []);
    }
  }

  for (const m of (movements ?? []) as MovementRow[]) {
    const inv = Array.isArray(m.investment) ? m.investment[0] : m.investment;
    if (!inv) continue;
    if (m.kind === "dividend" || m.kind === "split") continue;
    // só renda variável aqui
    if (!["stock", "etf", "fii"].includes(inv.asset_type)) continue;

    const qty = Number(m.quantity);
    const unitPriceBRL = convertOrSame(Number(m.unit_price), inv.currency, "BRL", rates);
    const totalBRL = convertOrSame(Number(m.total_amount), inv.currency, "BRL", rates);
    const feesBRL = convertOrSame(Number(m.fees ?? 0), inv.currency, "BRL", rates);
    const pos = positions.get(inv.id) ?? { qty: 0, totalCost: 0 };

    if (m.kind === "buy") {
      pos.qty += qty;
      pos.totalCost += totalBRL + feesBRL;
      positions.set(inv.id, pos);
    } else if (m.kind === "sell") {
      // Só conta vendas DENTRO do ano-base
      if (m.date < yearStart) {
        // Atualiza posição mas não computa
        if (pos.qty > 0) {
          pos.totalCost -= (pos.totalCost / pos.qty) * qty;
        }
        pos.qty -= qty;
        positions.set(inv.id, pos);
        continue;
      }
      const month = parseInt(m.date.slice(5, 7), 10);
      const avgCost = pos.qty > 0 ? pos.totalCost / pos.qty : 0;
      const costBasis = avgCost * qty;
      const grossSale = totalBRL - feesBRL; // valor líquido recebido
      const profit = grossSale - costBasis;

      const sale: SaleResult = {
        date: m.date,
        ticker: inv.ticker,
        assetType: inv.asset_type,
        qty,
        unitPrice: unitPriceBRL,
        grossSale: Math.round(grossSale * 100) / 100,
        costBasis: Math.round(costBasis * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        isDayTrade: m.is_day_trade,
      };

      let kind: IRDarfKind;
      if (inv.asset_type === "fii") kind = "fii";
      else if (m.is_day_trade) kind = "day_trade";
      else kind = "swing";

      salesByKind[kind].get(month)!.push(sale);

      // Atualiza posição
      pos.totalCost -= costBasis;
      pos.qty -= qty;
      positions.set(inv.id, pos);
    }
  }

  // Computa DARFs mês a mês, com carryforward de prejuízos
  const carry = { ...initialCarryforward };

  function buildMonths(kind: IRDarfKind): DarfMonth[] {
    const out: DarfMonth[] = [];
    for (let m = 1; m <= 12; m++) {
      const sales = salesByKind[kind].get(m) ?? [];
      const grossSales = sales.reduce((s, x) => s + x.grossSale, 0);
      const grossProfit = sales.reduce((s, x) => s + x.profit, 0);

      let isExempt = false;
      let taxableBase = 0;
      let monthlyLoss = 0;
      let carryUsed = 0;
      let irrfRetained = 0;
      let taxDue = 0;

      if (sales.length === 0) {
        out.push({
          year, month: m, kind,
          grossSales: 0, grossProfit: 0, monthlyLoss: 0,
          carryforwardUsedThisMonth: 0,
          carryforwardRemainingAfter: carry[kind],
          taxableBase: 0, irrfRetained: 0, taxDue: 0,
          isExempt: false,
          dueDate: lastBusinessDayOfNextMonth(year, m),
          sales: [],
        });
        continue;
      }

      // Isenção R$ 20k SÓ pra swing trade de AÇÕES (não FII, não ETF, não day trade)
      if (kind === "swing") {
        const allStocks = sales.every((s) => s.assetType === "stock");
        if (allStocks && grossSales <= SWING_EXEMPTION_LIMIT) {
          isExempt = true;
        }
      }

      if (isExempt) {
        // Mesmo isento: se prejuízo, soma ao carryforward
        if (grossProfit < 0) {
          monthlyLoss = -grossProfit;
          carry[kind] += monthlyLoss;
        }
      } else if (grossProfit <= 0) {
        // Prejuízo: vai pro carryforward
        monthlyLoss = -grossProfit;
        carry[kind] += monthlyLoss;
      } else {
        // Lucro: compensa carryforward
        carryUsed = Math.min(carry[kind], grossProfit);
        carry[kind] -= carryUsed;
        taxableBase = grossProfit - carryUsed;
        const rate = kind === "swing" ? SWING_RATE : kind === "day_trade" ? DAY_TRADE_RATE : FII_RATE;
        const grossTax = taxableBase * rate;
        // IRRF retido na fonte
        irrfRetained =
          kind === "swing"
            ? grossSales * SWING_IRRF_RATE
            : kind === "day_trade"
              ? grossProfit * DAY_TRADE_IRRF_RATE
              : grossSales * SWING_IRRF_RATE; // FII também 0,005% sobre vendas
        taxDue = Math.max(0, grossTax - irrfRetained);
      }

      out.push({
        year, month: m, kind,
        grossSales: Math.round(grossSales * 100) / 100,
        grossProfit: Math.round(grossProfit * 100) / 100,
        monthlyLoss: Math.round(monthlyLoss * 100) / 100,
        carryforwardUsedThisMonth: Math.round(carryUsed * 100) / 100,
        carryforwardRemainingAfter: Math.round(carry[kind] * 100) / 100,
        taxableBase: Math.round(taxableBase * 100) / 100,
        irrfRetained: Math.round(irrfRetained * 100) / 100,
        taxDue: Math.round(taxDue * 100) / 100,
        isExempt,
        dueDate: lastBusinessDayOfNextMonth(year, m),
        sales,
      });
    }
    return out;
  }

  const swing = buildMonths("swing");
  const dayTrade = buildMonths("day_trade");
  const fii = buildMonths("fii");

  const allMonths = [...swing, ...dayTrade, ...fii];
  const grossSalesYear = allMonths.reduce((s, m) => s + m.grossSales, 0);
  const grossProfitYear = allMonths.reduce((s, m) => s + m.grossProfit, 0);
  const totalTaxDue = allMonths.reduce((s, m) => s + m.taxDue, 0);
  const totalIRRF = allMonths.reduce((s, m) => s + m.irrfRetained, 0);

  return {
    year,
    swing,
    dayTrade,
    fii,
    finalCarryforward: {
      swing: Math.round(carry.swing * 100) / 100,
      day_trade: Math.round(carry.day_trade * 100) / 100,
      fii: Math.round(carry.fii * 100) / 100,
    },
    totals: {
      grossSalesYear: Math.round(grossSalesYear * 100) / 100,
      grossProfitYear: Math.round(grossProfitYear * 100) / 100,
      totalTaxDue: Math.round(totalTaxDue * 100) / 100,
      totalIRRF: Math.round(totalIRRF * 100) / 100,
    },
  };
}

/**
 * Persiste os DARFs gerados na tabela ir_darfs (idempotente — upsert por
 * household+year+month+kind). Atualiza também ir_loss_carryforward com o
 * saldo final do ano.
 */
export async function persistDarfs(
  householdId: string,
  report: RendaVariavelReport,
): Promise<{ persisted: number }> {
  const supabase = await createClient();
  const rows: Tables<"ir_darfs">["Insert" extends keyof Tables<"ir_darfs"> ? never : never] extends never
    ? Record<string, unknown>
    : never = {} as never;
  void rows;

  const allMonths = [...report.swing, ...report.dayTrade, ...report.fii];
  const toInsert = allMonths
    .filter((m) => m.grossSales > 0 || m.grossProfit !== 0)
    .map((m) => ({
      household_id: householdId,
      year: m.year,
      month: m.month,
      kind: m.kind,
      gross_sales: m.grossSales,
      gross_profit: m.grossProfit,
      monthly_loss: m.monthlyLoss,
      loss_carryforward_used: m.carryforwardUsedThisMonth,
      taxable_base: m.taxableBase,
      irrf_retained: m.irrfRetained,
      tax_due: m.taxDue,
      is_exempt: m.isExempt,
    }));

  if (toInsert.length === 0) return { persisted: 0 };

  // Apaga DARFs existentes do ano (recálculo limpo)
  await supabase
    .from("ir_darfs")
    .delete()
    .eq("household_id", householdId)
    .eq("year", report.year);

  const { error } = await supabase.from("ir_darfs").insert(toInsert);
  if (error) throw error;

  // Atualiza carryforward final
  const carryRows = (["swing", "day_trade", "fii"] as IRDarfKind[]).map((k) => ({
    household_id: householdId,
    kind: k,
    balance: report.finalCarryforward[k],
    last_updated_year: report.year,
    last_updated_month: 12,
  }));
  await supabase
    .from("ir_loss_carryforward")
    .upsert(carryRows, { onConflict: "household_id,kind" });

  return { persisted: toInsert.length };
}
