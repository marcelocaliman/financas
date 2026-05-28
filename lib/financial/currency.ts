import type { Currency } from "@/types/database";

/**
 * Conversão de valores monetários entre moedas.
 *
 * As taxas são armazenadas em `currency_rates` (base/quote/date) e
 * o service `services/currency.ts` é quem busca/atualiza. Aqui só temos
 * helpers puros que recebem o mapa de taxas pronto.
 *
 * Estrutura do mapa: `rates["BRL→EUR"] = 0.17`, `rates["EUR→BRL"] = 5.81`.
 * Pares idênticos (BRL→BRL) sempre retornam 1.
 */

export const SUPPORTED_CURRENCIES: Currency[] = ["BRL", "EUR", "USD", "GBP"];

export type RateMap = Record<string, number>;

function key(base: Currency, quote: Currency): string {
  return `${base}→${quote}`;
}

export function buildRateMap(
  rows: Array<{ base: Currency; quote: Currency; rate: number }>,
): RateMap {
  const map: RateMap = {};
  for (const r of rows) {
    map[key(r.base, r.quote)] = Number(r.rate);
  }
  for (const c of SUPPORTED_CURRENCIES) {
    map[key(c, c)] = 1;
  }
  return map;
}

/**
 * Converte `value` de `from` para `to` usando o mapa.
 * Se não existir taxa direta, tenta a inversa.
 * Retorna `null` se nada for encontrado (chamador decide fallback).
 */
export function convert(
  value: number,
  from: Currency,
  to: Currency,
  rates: RateMap,
): number | null {
  if (from === to) return value;
  const direct = rates[key(from, to)];
  if (direct && direct > 0) return value * direct;
  const inverse = rates[key(to, from)];
  if (inverse && inverse > 0) return value / inverse;
  return null;
}

/**
 * Igual a `convert`, mas se não houver taxa, retorna o valor original.
 * Usar quando preferimos "mostrar algo" a "quebrar a UI".
 */
export function convertOrSame(
  value: number,
  from: Currency,
  to: Currency,
  rates: RateMap,
): number {
  const r = convert(value, from, to, rates);
  return r ?? value;
}

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  BRL: "R$",
  EUR: "€",
  USD: "US$",
  GBP: "£",
};

export const CURRENCY_LOCALES: Record<Currency, string> = {
  BRL: "pt-BR",
  EUR: "pt-PT",
  USD: "en-US",
  GBP: "en-GB",
};

const FORMATTERS: Partial<Record<Currency, Intl.NumberFormat>> = {};

export function formatCurrency(value: number, currency: Currency): string {
  if (!FORMATTERS[currency]) {
    FORMATTERS[currency] = new Intl.NumberFormat(CURRENCY_LOCALES[currency], {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return FORMATTERS[currency]!.format(value);
}

const COMPACT_FORMATTERS: Partial<Record<Currency, Intl.NumberFormat>> = {};

export function formatCurrencyCompact(value: number, currency: Currency): string {
  if (!COMPACT_FORMATTERS[currency]) {
    COMPACT_FORMATTERS[currency] = new Intl.NumberFormat(CURRENCY_LOCALES[currency], {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    });
  }
  return COMPACT_FORMATTERS[currency]!.format(value);
}
