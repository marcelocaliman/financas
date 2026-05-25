/**
 * Tabela progressiva MENSAL do IRPF — usada no carnê-leão e na retenção
 * mensal de salários.
 *
 * Atualizada conforme MP 1.171/2023 + Lei 14.663/23 (vigência maio/2023):
 *   Até R$ 2.259,20             — isento
 *   R$ 2.259,21 a R$ 2.826,65   — 7,5% (parcela a deduzir: R$ 169,44)
 *   R$ 2.826,66 a R$ 3.751,05   — 15%  (parcela a deduzir: R$ 381,44)
 *   R$ 3.751,06 a R$ 4.664,68   — 22,5% (parcela a deduzir: R$ 662,77)
 *   Acima de R$ 4.664,68         — 27,5% (parcela a deduzir: R$ 896,00)
 *
 * Dedução por dependente (mensal): R$ 189,59
 */

const MONTHLY_BRACKETS = [
  { upTo: 2259.20, rate: 0, deduct: 0 },
  { upTo: 2826.65, rate: 0.075, deduct: 169.44 },
  { upTo: 3751.05, rate: 0.15, deduct: 381.44 },
  { upTo: 4664.68, rate: 0.225, deduct: 662.77 },
  { upTo: Infinity, rate: 0.275, deduct: 896.00 },
];

export const MONTHLY_DEPENDENT_DEDUCTION = 189.59;

export type CarneLeaoCalc = {
  grossIncome: number;
  deductibleExpenses: number;
  dependentsDeduction: number;
  taxableBase: number;
  rate: number;
  deductPortion: number;
  taxDue: number;
  /** Vencimento DARF = último dia útil do mês SEGUINTE ao recebimento */
  darfDueDate: string;
  bracketDescription: string;
};

function lastBusinessDayOfNextMonth(refDate: string): string {
  const d = new Date(refDate);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 2, 0);
  while (lastDay.getDay() === 0 || lastDay.getDay() === 6) {
    lastDay.setDate(lastDay.getDate() - 1);
  }
  return lastDay.toISOString().slice(0, 10);
}

/**
 * Calcula o IR devido no carnê-leão pra UM mês.
 */
export function computeCarneLeaoMonthly(args: {
  /** Rendimentos brutos do mês (já em BRL) */
  grossIncome: number;
  /** Deduções aplicáveis (pensão, livro caixa, etc.) */
  deductibleExpenses?: number;
  /** Número de dependentes */
  numDependents?: number;
  /** Data de competência (ex.: 2026-04-15 → DARF até último dia útil de maio) */
  competenceDate: string;
}): CarneLeaoCalc {
  const gross = Math.max(0, args.grossIncome);
  const deductibles = Math.max(0, args.deductibleExpenses ?? 0);
  const numDep = Math.max(0, args.numDependents ?? 0);
  const depsDeduction = numDep * MONTHLY_DEPENDENT_DEDUCTION;
  const base = Math.max(0, gross - deductibles - depsDeduction);

  // Encontra a faixa
  let bracket = MONTHLY_BRACKETS[0];
  for (const b of MONTHLY_BRACKETS) {
    bracket = b;
    if (base <= b.upTo) break;
  }
  const taxDue = Math.max(0, base * bracket.rate - bracket.deduct);

  const bracketDescription =
    bracket.rate === 0
      ? "Isenta"
      : `${(bracket.rate * 100).toFixed(1)}% · dedução R$ ${bracket.deduct.toFixed(2)}`;

  return {
    grossIncome: gross,
    deductibleExpenses: deductibles,
    dependentsDeduction: Math.round(depsDeduction * 100) / 100,
    taxableBase: Math.round(base * 100) / 100,
    rate: bracket.rate,
    deductPortion: bracket.deduct,
    taxDue: Math.round(taxDue * 100) / 100,
    darfDueDate: lastBusinessDayOfNextMonth(args.competenceDate),
    bracketDescription,
  };
}
