import "server-only";
import { createClient } from "@/lib/supabase/server";
import { computeCarneLeaoMonthly } from "@/lib/financial/irpf-monthly-table";
import type { Tables, CarneLeaoKind } from "@/types/database";

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
 *          aplica tabela progressiva mensal IRPF.
 */

// Tabelas progressivas mensais IRPF — variam por ano/mês quando há MP.
// Conferir Anexo da IN RFB vigente antes de mudanças.
type Bracket = { upTo: number; rate: number; deduct: number };

// Tabela vigente Jan-Abr/2024
const MONTHLY_2024_JAN_APR: Bracket[] = [
  { upTo: 2112.00, rate: 0, deduct: 0 },
  { upTo: 2826.65, rate: 0.075, deduct: 158.40 },
  { upTo: 3751.05, rate: 0.15, deduct: 370.40 },
  { upTo: 4664.68, rate: 0.225, deduct: 651.73 },
  { upTo: Infinity, rate: 0.275, deduct: 884.96 },
];

// Tabela vigente Maio/2024+ (MP 1.171/2023) e 2025
const MONTHLY_2024_MAY_PLUS: Bracket[] = [
  { upTo: 2259.20, rate: 0, deduct: 0 },
  { upTo: 2826.65, rate: 0.075, deduct: 169.44 },
  { upTo: 3751.05, rate: 0.15, deduct: 381.44 },
  { upTo: 4664.68, rate: 0.225, deduct: 662.77 },
  { upTo: Infinity, rate: 0.275, deduct: 896.00 },
];

function bracketsFor(year: number, month: number): Bracket[] {
  // 2023 e antes: tabela antiga (≤2112 isento, deduções diferentes)
  // 2024 jan-abr: tabela 2024 original
  // 2024 mai+ e 2025+: tabela atualizada
  if (year < 2024) return MONTHLY_2024_JAN_APR; // aproximação — sem dados pré-2024 vivos
  if (year === 2024 && month <= 4) return MONTHLY_2024_JAN_APR;
  return MONTHLY_2024_MAY_PLUS;
}

function calcMonthlyTax(base: number, year?: number, month?: number): number {
  const brackets = bracketsFor(year ?? new Date().getUTCFullYear(), month ?? 1);
  for (const b of brackets) {
    if (base <= b.upTo) return Math.max(0, base * b.rate - b.deduct);
  }
  return 0;
}

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
export function computeCarneLeaoTax(args: {
  grossAmount: number;
  deductibleExpenses: number;
  /** Dedução por dependentes (no mês). R$ 189,59 × N dependentes em 2024 */
  dependentDeduction?: number;
  /** Ano + mês pra escolher tabela progressiva vigente (mid-year MP) */
  year?: number;
  month?: number;
  /** Pra calcular vencimento DARF (default: 15 do mês de competência) */
  competenceDate?: string;
}): {
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
  };
} {
  const base = Math.max(
    0,
    args.grossAmount - args.deductibleExpenses - (args.dependentDeduction ?? 0),
  );
  const taxDue = calcMonthlyTax(base, args.year, args.month);
  // Pra breakdown, usamos a tabela atual (irpf-monthly-table)
  const competence =
    args.competenceDate ?? `${args.year ?? new Date().getFullYear()}-${String(args.month ?? 1).padStart(2, "0")}-15`;
  const detail = computeCarneLeaoMonthly({
    grossIncome: args.grossAmount,
    deductibleExpenses: args.deductibleExpenses,
    numDependents: 0, // já vem como dependentDeduction agregado
    competenceDate: competence,
  });
  return {
    taxableBase: Math.round(base * 100) / 100,
    taxDue: Math.round(taxDue * 100) / 100,
    dueDate: detail.darfDueDate,
    breakdown: {
      grossAmount: args.grossAmount,
      deductibleExpenses: args.deductibleExpenses,
      dependentDeduction: args.dependentDeduction ?? 0,
      taxableBase: Math.round(base * 100) / 100,
      rate: detail.rate,
      deductPortion: detail.deductPortion,
      bracketDescription: detail.bracketDescription,
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
  const byMonth: Map<number, { gross: number; tax: number; pending: number }> = new Map();
  for (let m = 1; m <= 12; m++) byMonth.set(m, { gross: 0, tax: 0, pending: 0 });
  let totalGross = 0, totalTax = 0, totalPaid = 0, totalPending = 0;

  for (const r of rows) {
    const e = byMonth.get(r.month)!;
    const g = Number(r.gross_amount);
    const t = Number(r.tax_due);
    e.gross += g;
    e.tax += t;
    totalGross += g;
    totalTax += t;
    if (r.paid_at) totalPaid += t;
    else {
      totalPending += t;
      e.pending += t;
    }
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    totalGross: round2(totalGross),
    totalTax: round2(totalTax),
    totalPaid: round2(totalPaid),
    totalPending: round2(totalPending),
    byMonth: Array.from(byMonth.entries()).map(([month, e]) => ({
      month,
      gross: round2(e.gross),
      tax: round2(e.tax),
      pending: round2(e.pending),
    })),
  };
}

export { lastBusinessDayOfNextMonth, calcMonthlyTax };
