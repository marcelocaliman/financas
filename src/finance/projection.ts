/**
 * Projeção de juros compostos com aportes mensais — módulo PURO (BRIEF §10).
 *   - taxa mensal: i = (1 + retorno_anual)^(1/12) − 1
 *   - saldo no ano t: inicial × (1+i)^(12t) + aporte × (((1+i)^(12t) − 1) / i)
 *   - valor real (moeda de hoje): saldo / (1 + inflação)^t
 */

/** Converte retorno anual (ex.: 0.10 = 10% a.a.) em taxa mensal equivalente. */
export function monthlyRate(annualReturn: number): number {
  return Math.pow(1 + annualReturn, 1 / 12) - 1;
}

/** Saldo nominal após `years` anos. Equivale a FV(i, 12·t, −aporte, −inicial). */
export function projectBalance(
  initial: number,
  monthlyContribution: number,
  annualReturn: number,
  years: number,
): number {
  const i = monthlyRate(annualReturn);
  const n = 12 * years;
  if (i === 0) return initial + monthlyContribution * n;
  return (
    initial * Math.pow(1 + i, n) +
    monthlyContribution * ((Math.pow(1 + i, n) - 1) / i)
  );
}

/** Desconta a inflação: valor do montante na moeda de HOJE. */
export function realValue(nominal: number, annualInflation: number, years: number): number {
  return nominal / Math.pow(1 + annualInflation, years);
}

export type ProjectionPoint = {
  year: number;
  nominal: number;
  real: number;
};

/** Série ano a ano (0..years) com nominal e valor real. */
export function projectionSeries(params: {
  initial: number;
  monthlyContribution: number;
  annualReturn: number;
  annualInflation: number;
  years: number;
}): ProjectionPoint[] {
  const { initial, monthlyContribution, annualReturn, annualInflation, years } = params;
  const out: ProjectionPoint[] = [];
  for (let t = 0; t <= years; t++) {
    const nominal = projectBalance(initial, monthlyContribution, annualReturn, t);
    out.push({ year: t, nominal, real: realValue(nominal, annualInflation, t) });
  }
  return out;
}
