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

import { isBusinessDay } from "./business-days";

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
  const y = parseInt(refDate.slice(0, 4), 10);
  const mo = parseInt(refDate.slice(5, 7), 10); // 1-12
  const d = new Date(Date.UTC(y, mo + 1, 0)); // último dia do mês seguinte
  // Recua fim de semana E feriado nacional (Lei 8.134/90; RIR/2018 art. 118).
  while (!isBusinessDay(d.toISOString().slice(0, 10))) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d.toISOString().slice(0, 10);
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
  /** Ano-base — aplica redutor da Lei 15.270/2025 a partir de 2026 */
  year?: number;
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
  const taxBeforeReduction = Math.max(0, base * bracket.rate - bracket.deduct);
  // Redutor Lei 15.270/25 (a partir de ano-base 2026) — opera sobre o
  // RENDIMENTO BRUTO mensal, não sobre a base. Zera até R$ 5.000;
  // decai até R$ 7.350 pela fórmula 978,62 − 0,133145 × renda_bruta.
  const redutor = computeRedutorMensal(args.year ?? 0, gross);
  const taxDue = Math.max(0, taxBeforeReduction - redutor);

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

/**
 * Redutor mensal instituído pela Lei 15.270/2025 (ano-base 2026+).
 *
 *  - Renda bruta ≤ R$ 5.000: redutor = R$ 312,89 (limitado ao imposto bruto).
 *  - R$ 5.000 < renda ≤ R$ 7.350: redutor = 978,62 − 0,133145 × renda.
 *  - Renda > R$ 7.350: redutor = 0.
 *
 * NÃO gera crédito — só limita a 0 ≤ redutor ≤ imposto_bruto, o caller faz
 * a clampagem final com o imposto.
 */
export function computeRedutorMensal(
  year: number,
  rendaBrutaMensal: number,
): number {
  if (year < 2026) return 0;
  if (rendaBrutaMensal <= 5_000) return 312.89;
  if (rendaBrutaMensal >= 7_350) return 0;
  return Math.max(0, 978.62 - 0.133145 * rendaBrutaMensal);
}

/**
 * Multa e juros de mora de DARF pago em atraso (Lei 9.430/96 art. 61):
 *  - Multa de mora: 0,33% por dia de atraso, limitada a 20%.
 *  - Juros de mora: SELIC acumulada do mês seguinte ao vencimento até o mês
 *    anterior ao pagamento + 1% no mês do pagamento.
 *
 * `selicAccumulated` é a SELIC acumulada do período (fração, ex.: 0,025 = 2,5%);
 * o app passa quando tem a série — senão fica só a multa (juros 0). Função PURA.
 */
export function computeLateFee(args: {
  principal: number;
  daysLate: number;
  /** SELIC acumulada do período como fração (default 0 = sem dado de juros). */
  selicAccumulated?: number;
}): { multa: number; juros: number; total: number } {
  const principal = Math.max(0, args.principal);
  const round2 = (n: number) => Math.round(n * 100) / 100;
  if (principal === 0 || args.daysLate <= 0) {
    return { multa: 0, juros: 0, total: principal };
  }
  const multaRate = Math.min(0.2, 0.0033 * args.daysLate); // teto 20%
  const multa = round2(principal * multaRate);
  // Juros SELIC do período + 1% no mês do pagamento (quando há dado de SELIC).
  const jurosRate = (args.selicAccumulated ?? 0) > 0 ? (args.selicAccumulated ?? 0) + 0.01 : 0;
  const juros = round2(principal * jurosRate);
  return { multa, juros, total: round2(principal + multa + juros) };
}
