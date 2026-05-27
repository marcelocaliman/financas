/**
 * Cálculo do IRPF mensal (carnê-leão / retenção fonte).
 *
 * As tabelas progressivas (faixas + dedução por dependente) viviam aqui
 * hardcoded. Agora vivem no banco em `ir_tax_table_monthly` — a função
 * aceita as faixas como parâmetro pra ficar pura.
 *
 * Fallback: se brackets não forem informados, usa a MP 1206/24 (vigente
 * mai/2024+) como default. Útil pra testes ou retrocompat.
 */

type Bracket = { upTo: number; rate: number; deduct: number };

/** Fallback (MP 1206/24 vigente mai/2024+). Usar só em testes/retrocompat. */
const DEFAULT_MONTHLY_BRACKETS: Bracket[] = [
  { upTo: 2259.20, rate: 0, deduct: 0 },
  { upTo: 2826.65, rate: 0.075, deduct: 169.44 },
  { upTo: 3751.05, rate: 0.15, deduct: 381.44 },
  { upTo: 4664.68, rate: 0.225, deduct: 662.77 },
  { upTo: Infinity, rate: 0.275, deduct: 896.00 },
];

/** Fallback de dedução por dependente (mensal R$ 189,59 — MP 1206/24) */
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
 *
 * @param args.brackets - Faixas progressivas mensais (carregadas de
 *   ir_tax_table_monthly pelo caller). Default: MP 1206/24.
 * @param args.dependentDeductionPerOne - Dedução mensal por dependente
 *   (carregada do banco). Default: R$ 189,59.
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
  /** Tabela progressiva (do banco); fallback MP 1206/24 */
  brackets?: Bracket[];
  /** Dedução mensal por dependente; fallback R$ 189,59 */
  dependentDeductionPerOne?: number;
}): CarneLeaoCalc {
  const brackets = args.brackets ?? DEFAULT_MONTHLY_BRACKETS;
  const depPerOne = args.dependentDeductionPerOne ?? MONTHLY_DEPENDENT_DEDUCTION;
  const gross = Math.max(0, args.grossIncome);
  const deductibles = Math.max(0, args.deductibleExpenses ?? 0);
  const numDep = Math.max(0, args.numDependents ?? 0);
  const depsDeduction = numDep * depPerOne;
  const base = Math.max(0, gross - deductibles - depsDeduction);

  // Encontra a faixa
  let bracket = brackets[0];
  for (const b of brackets) {
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
