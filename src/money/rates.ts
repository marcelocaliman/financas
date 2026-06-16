import { CURRENCIES, DEFAULT_RATES, type Currency, type RateTable } from "./currency";

/**
 * Cotação de câmbio — Frankfurter (frankfurter.app): gratuita, SEM token, taxas de
 * referência do BCE atualizadas em dias úteis. Módulo PURO/testável: monta a RateTable
 * (cada moeda expressa em BRL; BRL = 1) a partir da resposta. Sem dado do usuário sai
 * daqui — só pares de moeda públicos. brapi (com token) fica pra cotação de ATIVOS depois.
 */

const ENDPOINT = "https://api.frankfurter.app/latest";
const BASE: Currency = "BRL";

interface FrankfurterResponse {
  base?: string;
  date?: string;
  rates?: Record<string, number>;
}

/**
 * Frankfurter com base=BRL devolve "quanto de cada moeda vale 1 BRL" (ex.: USD 0,18).
 * Nossa RateTable guarda o INVERSO: quanto de BRL vale 1 unidade da moeda (USD ≈ 5,55).
 */
export function ratesFromFrankfurter(data: FrankfurterResponse): RateTable {
  const out: RateTable = { ...DEFAULT_RATES, [BASE]: 1 };
  const r = data.rates ?? {};
  for (const c of CURRENCIES) {
    if (c === BASE) {
      out[c] = 1;
      continue;
    }
    const perBase = r[c];
    out[c] = typeof perBase === "number" && perBase > 0 ? 1 / perBase : DEFAULT_RATES[c];
  }
  return out;
}

export async function fetchRates(signal?: AbortSignal): Promise<RateTable> {
  const symbols = CURRENCIES.filter((c) => c !== BASE).join(",");
  const res = await fetch(`${ENDPOINT}?base=${BASE}&symbols=${symbols}`, { signal });
  if (!res.ok) throw new Error(`câmbio HTTP ${res.status}`);
  return ratesFromFrankfurter((await res.json()) as FrankfurterResponse);
}

/** TTL de 12h → garante atualização "pelo menos 1x ao dia". */
export const RATES_TTL_MS = 12 * 60 * 60 * 1000;

export function isStale(updatedAt: number | null, now: number): boolean {
  return updatedAt == null || now - updatedAt > RATES_TTL_MS;
}
