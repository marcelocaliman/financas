import "server-only";
import { createClient } from "@/lib/supabase/server";
import { computeCarneLeaoMonthly } from "@/lib/financial/irpf-monthly-table";
import { isBusinessDay } from "@/lib/financial/business-days";
import { getMonthlyTaxTable } from "@/services/ir/ir-tax-tables";
import type { Tables } from "@/types/database";

/**
 * Carnê-leão mensal — DARF código 0190.
 *
 * Pra rendimentos recebidos de PF (não retidos na fonte):
 *  - Aluguel recebido
 *  - Freelance pago por PF
 *  - Pensão recebida
 *  - Trabalho no exterior
 *
 * Vencimento: último dia útil do mês seguinte.
 * Cálculo: rendimento bruto − deduções legais (INSS, dependentes, etc.)
 *          aplica tabela progressiva mensal IRPF (lida de ir_tax_table_monthly).
 */

function lastBusinessDayOfNextMonth(year: number, month: number): string {
  let y = year;
  let m = month + 1;
  if (m > 12) { m = 1; y++; }
  const last = new Date(Date.UTC(y, m, 0));
  // Recua fim de semana E feriado nacional.
  while (!isBusinessDay(last.toISOString().slice(0, 10))) {
    last.setUTCDate(last.getUTCDate() - 1);
  }
  return last.toISOString().slice(0, 10);
}

export async function listCarneLeao(
  year: number,
  householdId?: string,
): Promise<Tables<"carne_leao_mensal">[]> {
  const supabase = await createClient();
  let q = supabase
    .from("carne_leao_mensal")
    .select("*")
    .eq("year", year)
    .order("month")
    .order("created_at");
  if (householdId) q = q.eq("household_id", householdId);
  const { data } = await q;
  return data ?? [];
}

/**
 * Calcula imposto devido pra uma entrada de carnê-leão.
 * Usado na hora de cadastrar/editar.
 *
 * Adota a tabela mensal vigente (centralizada em irpf-monthly-table.ts).
 * Retorna também o breakdown completo pra persistir em
 * carne_leao_mensal.computation_breakdown.
 */
export async function computeCarneLeaoTax(args: {
  grossAmount: number;
  deductibleExpenses: number;
  /** Dedução por dependentes (no mês). Calculada via tabela do banco se omitida. */
  dependentDeduction?: number;
  /** Ano + mês pra escolher tabela progressiva vigente (mid-year MP) */
  year?: number;
  month?: number;
  /** Pra calcular vencimento DARF (default: 15 do mês de competência) */
  competenceDate?: string;
}): Promise<{
  taxableBase: number;
  taxDue: number;
  dueDate: string | null;
  breakdown: {
    grossAmount: number;
    deductibleExpenses: number;
    dependentDeduction: number;
    taxableBase: number;
    rate: number;
    deductPortion: number;
    bracketDescription: string;
    tableSource: string;
  };
}> {
  const year = args.year ?? new Date().getUTCFullYear();
  const month = args.month ?? 1;
  // Carrega tabela vigente em (year, month) do banco. Throw se não cadastrada.
  const taxTable = await getMonthlyTaxTable(year, month);

  const competence =
    args.competenceDate ?? `${year}-${String(month).padStart(2, "0")}-15`;
  const detail = computeCarneLeaoMonthly({
    grossIncome: args.grossAmount,
    deductibleExpenses: args.deductibleExpenses,
    numDependents: 0, // já vem como dependentDeduction agregado
    competenceDate: competence,
    brackets: taxTable.brackets,
    dependentDeductionPerOne: taxTable.dependentDeduction,
    year,
  });
  const base = Math.max(
    0,
    args.grossAmount - args.deductibleExpenses - (args.dependentDeduction ?? 0),
  );
  return {
    taxableBase: Math.round(base * 100) / 100,
    taxDue: Math.round(detail.taxDue * 100) / 100,
    dueDate: detail.darfDueDate,
    breakdown: {
      grossAmount: args.grossAmount,
      deductibleExpenses: args.deductibleExpenses,
      dependentDeduction: args.dependentDeduction ?? 0,
      taxableBase: Math.round(base * 100) / 100,
      rate: detail.rate,
      deductPortion: detail.deductPortion,
      bracketDescription: detail.bracketDescription,
      tableSource: taxTable.source,
    },
  };
}

export type CarneLeaoSummary = {
  totalGross: number;
  totalTax: number;
  totalPaid: number;
  totalPending: number;
  byMonth: Array<{ month: number; gross: number; tax: number; pending: number }>;
};

export async function getCarneLeaoSummary(
  year: number,
  householdId?: string,
): Promise<CarneLeaoSummary> {
  const rows = await listCarneLeao(year, householdId);

  // Agrega por mês. O carnê-leão é apurado MENSALMENTE: a tabela progressiva se
  // aplica UMA vez sobre a soma dos rendimentos do mês, não por lançamento
  // (somar tax_due por entrada subtributa — cada entrada caía sozinha na faixa
  // isenta). Recalculamos o imposto agregado por mês aqui.
  type MonthAgg = { gross: number; deductible: number; allPaid: boolean; hasEntries: boolean };
  const agg = new Map<number, MonthAgg>();
  for (let m = 1; m <= 12; m++) {
    agg.set(m, { gross: 0, deductible: 0, allPaid: true, hasEntries: false });
  }
  for (const r of rows) {
    const a = agg.get(r.month)!;
    a.gross += Number(r.gross_amount);
    a.deductible += Number(r.deductible_expenses ?? 0);
    a.hasEntries = true;
    if (!r.paid_at) a.allPaid = false;
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  let totalGross = 0, totalTax = 0, totalPaid = 0, totalPending = 0;
  const byMonth: CarneLeaoSummary["byMonth"] = [];

  for (let m = 1; m <= 12; m++) {
    const a = agg.get(m)!;
    let tax = 0;
    if (a.hasEntries && a.gross > 0) {
      const table = await getMonthlyTaxTable(year, m);
      const detail = computeCarneLeaoMonthly({
        grossIncome: a.gross,
        deductibleExpenses: a.deductible,
        numDependents: 0,
        competenceDate: `${year}-${String(m).padStart(2, "0")}-15`,
        brackets: table.brackets,
        dependentDeductionPerOne: table.dependentDeduction,
        year,
      });
      tax = round2(detail.taxDue);
    }
    const pending = a.allPaid ? 0 : tax;
    totalGross += a.gross;
    totalTax += tax;
    if (a.allPaid) totalPaid += tax;
    else totalPending += tax;
    byMonth.push({ month: m, gross: round2(a.gross), tax, pending });
  }

  return {
    totalGross: round2(totalGross),
    totalTax: round2(totalTax),
    totalPaid: round2(totalPaid),
    totalPending: round2(totalPending),
    byMonth,
  };
}

export { lastBusinessDayOfNextMonth };
