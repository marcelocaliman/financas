/**
 * Aritmética monetária — operar internamente em CENTAVOS (inteiros)
 * para evitar drift de float, retornar em reais quando exposto à UI.
 *
 * Convenção:
 *  - persistir no Postgres como numeric(14, 2) em reais
 *  - quando precisar somar/multiplicar com precisão, converter pra cents
 */

export function toCents(value: number): number {
  return Math.round(value * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function sumMoney(values: number[]): number {
  const totalCents = values.reduce((acc, v) => acc + toCents(v), 0);
  return fromCents(totalCents);
}

export function subtractMoney(a: number, b: number): number {
  return fromCents(toCents(a) - toCents(b));
}

export function multiplyMoney(value: number, factor: number): number {
  return fromCents(Math.round(toCents(value) * factor));
}

/**
 * Aplica taxa diária composta a um saldo.
 * dailyRate em decimal (ex.: 0.0005422 para Selic ~14% a.a.)
 */
export function applyDailyRate(balance: number, dailyRate: number): number {
  return multiplyMoney(balance, 1 + dailyRate);
}

/**
 * Selic anual → taxa diária composta (base 252 dias úteis).
 * annualRate em decimal (0.145 = 14.5% a.a.)
 */
export function selicDailyRate(annualRate: number): number {
  return Math.pow(1 + annualRate, 1 / 252) - 1;
}
