/**
 * Cotação de ATIVOS — via NOSSO proxy serverless (/api/quote), que guarda o token brapi
 * do dono como variável de ambiente do servidor. O usuário não configura nada; o app já
 * vem com cotação funcionando. Parser PURO/testável; o fetch só monta a URL e delega.
 */

export interface Quote {
  price: number;
  currency: string;
}

const ENDPOINT = "/api/quote";

interface BrapiResult {
  symbol?: string;
  regularMarketPrice?: number;
  currency?: string;
}

/** Extrai { TICKER: {price, currency} } da resposta da brapi (ignora itens sem preço). */
export function parseQuotes(data: { results?: BrapiResult[] }): Record<string, Quote> {
  const out: Record<string, Quote> = {};
  for (const r of data.results ?? []) {
    if (r?.symbol && typeof r.regularMarketPrice === "number" && r.regularMarketPrice > 0) {
      out[r.symbol.toUpperCase()] = { price: r.regularMarketPrice, currency: r.currency ?? "BRL" };
    }
  }
  return out;
}

/** Normaliza/depura a lista de tickers (únicos, maiúsculos, sem vazios). */
export function normalizeTickers(tickers: (string | undefined)[]): string[] {
  return [...new Set(tickers.map((t) => (t ?? "").trim().toUpperCase()).filter(Boolean))];
}

export async function fetchQuotes(
  tickers: (string | undefined)[],
  signal?: AbortSignal,
): Promise<Record<string, Quote>> {
  const list = normalizeTickers(tickers);
  if (list.length === 0) return {};
  const res = await fetch(`${ENDPOINT}?tickers=${encodeURIComponent(list.join(","))}`, { signal });
  if (!res.ok) throw new Error(`quote HTTP ${res.status}`);
  return parseQuotes((await res.json()) as { results?: BrapiResult[] });
}

export const QUOTES_TTL_MS = 6 * 60 * 60 * 1000; // 6h

export function isQuotesStale(updatedAt: number | null, now: number): boolean {
  return updatedAt == null || now - updatedAt > QUOTES_TTL_MS;
}
