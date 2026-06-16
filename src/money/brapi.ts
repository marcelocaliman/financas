/**
 * Cotação de ATIVOS via brapi (brapi.dev) — chamada DIRETO do navegador com o token
 * do próprio usuário (guardado cifrado no blob E2EE). Nosso servidor nunca vê o token
 * nem os tickers. Parser PURO/testável; o fetch só monta a URL e delega.
 */

export interface Quote {
  price: number;
  currency: string;
}

const BASE = "https://brapi.dev/api/quote";

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
  token: string,
  signal?: AbortSignal,
): Promise<Record<string, Quote>> {
  const list = normalizeTickers(tickers);
  if (list.length === 0 || !token.trim()) return {};
  const url = `${BASE}/${encodeURIComponent(list.join(","))}?token=${encodeURIComponent(token.trim())}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`brapi HTTP ${res.status}`);
  return parseQuotes((await res.json()) as { results?: BrapiResult[] });
}

export const QUOTES_TTL_MS = 6 * 60 * 60 * 1000; // 6h

export function isQuotesStale(updatedAt: number | null, now: number): boolean {
  return updatedAt == null || now - updatedAt > QUOTES_TTL_MS;
}
