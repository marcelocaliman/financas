/**
 * Câmbio e formatação — módulo PURO e testável (BRIEF §10).
 * Cada item guarda a própria moeda; aqui convertemos pra moeda de exibição.
 */

export type Currency = "BRL" | "EUR" | "USD" | "GBP";

export const CURRENCIES: Currency[] = ["BRL", "EUR", "USD", "GBP"];

/**
 * Taxa de cada moeda expressa em unidades da MOEDA-BASE (BRL).
 * Ex.: EUR = 5.97 → 1 EUR vale 5,97 BRL. A base (BRL) é sempre 1.
 * No app real isto vem da API de câmbio (com cache + fallback manual).
 */
export type RateTable = Record<Currency, number>;

export const DEFAULT_RATES: RateTable = {
  BRL: 1,
  EUR: 5.97,
  USD: 5.45,
  GBP: 6.9,
};

/**
 * Espelho mutável das taxas ATUAIS (atualizado pelo store de câmbio a partir da API
 * diária, com fallback manual/cache). Mantido aqui pra que `convert`/`currencyBreakdown`
 * usem a cotação viva por padrão SEM cada call-site precisar passar a tabela. Componentes
 * que precisam reagir à atualização leem `useRates` e incluem nas deps do useMemo.
 */
let liveRates: RateTable = DEFAULT_RATES;
export function setLiveRates(rates: RateTable): void {
  liveRates = rates;
}
export function getLiveRates(): RateTable {
  return liveRates;
}

/**
 * Converte entre duas moedas usando as duas taxas → base.
 * convert(100, "EUR", "BRL") = 100 × 5.97 / 1 = 597.
 */
export function convert(
  amount: number,
  from: Currency,
  to: Currency,
  rates: RateTable = liveRates,
): number {
  if (from === to) return amount;
  const inBase = amount * rates[from];
  return inBase / rates[to];
}

const LOCALE: Record<Currency, string> = {
  BRL: "pt-BR",
  EUR: "it-IT",
  USD: "en-US",
  GBP: "en-GB",
};

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  BRL: "R$",
  EUR: "€",
  USD: "US$",
  GBP: "£",
};

/** Formata um valor já na moeda dada. Inteiro por padrão (sem centavos). */
export function formatMoney(
  amount: number,
  currency: Currency,
  opts: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(LOCALE[currency], {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    ...opts,
  }).format(amount);
}
