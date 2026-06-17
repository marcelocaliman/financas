/**
 * Independência financeira (FIRE) — módulo PURO e testável.
 *
 * Regra dos 4% (Trinity): se você retira `swr`% do patrimônio por ano, ele tende a durar
 * indefinidamente. Logo o "número FIRE" = gastos anuais ÷ taxa de retirada (4% → 25×).
 *
 * Tudo em MOEDA DE HOJE: o alvo são os gastos atuais e o patrimônio cresce ao retorno
 * REAL (já descontada a inflação) — coerente com a linha "valor de hoje" da Projeção.
 */

/** Número FIRE: patrimônio-alvo que sustenta os gastos anuais à taxa de retirada dada. */
export function fireNumber(annualExpenses: number, withdrawalRatePct: number): number {
  if (withdrawalRatePct <= 0 || annualExpenses <= 0) return annualExpenses <= 0 ? 0 : Infinity;
  return annualExpenses / (withdrawalRatePct / 100);
}

/** Retorno REAL a partir do nominal e da inflação (ambos em %): (1+r)/(1+π) − 1, decimal. */
export function realReturn(nominalPct: number, inflationPct: number): number {
  return (1 + nominalPct / 100) / (1 + inflationPct / 100) - 1;
}

/** Renda passiva mensal que um patrimônio sustenta à taxa de retirada (regra dos 4%). */
export function safeMonthlyIncome(portfolio: number, withdrawalRatePct: number): number {
  return Math.max(0, portfolio) * (withdrawalRatePct / 100) / 12;
}

/**
 * Anos (fracionários) até o patrimônio alcançar o alvo, crescendo ao retorno REAL com
 * aporte mensal (de hoje). `0` = já atingiu; `null` = inalcançável (sem juro nem aporte,
 * ou retorno real negativo cujo teto não chega ao alvo, ou além de ~200 anos).
 */
export function yearsToFI(params: {
  portfolio: number;
  monthlyContribution: number;
  realAnnualReturn: number; // decimal (ex.: 0.04)
  target: number;
}): number | null {
  const { portfolio, monthlyContribution, realAnnualReturn, target } = params;
  if (!Number.isFinite(target) || target <= 0) return null;
  if (portfolio >= target) return 0;

  const m = monthlyContribution;
  const i = Math.pow(1 + realAnnualReturn, 1 / 12) - 1; // taxa mensal real
  let n: number; // meses

  if (Math.abs(i) < 1e-12) {
    if (m <= 0) return null; // estagnado e abaixo do alvo → nunca
    n = (target - portfolio) / m;
  } else {
    // saldo(n) = portfolio·(1+i)^n + m·((1+i)^n − 1)/i = target
    // ⇒ (1+i)^n = (target + m/i) / (portfolio + m/i)
    const k = m / i;
    const denom = portfolio + k;
    const ratio = denom !== 0 ? (target + k) / denom : -1;
    if (ratio <= 0) return null; // teto (retorno real ≤ 0) abaixo do alvo → inalcançável
    n = Math.log(ratio) / Math.log(1 + i);
  }

  if (!Number.isFinite(n) || n <= 0 || n / 12 > 200) return null;
  return n / 12;
}
