/**
 * brapi.dev — cotações em tempo real da B3 (FIIs, ações, ETFs).
 * Free tier funciona sem token (rate limit ~50/dia/IP).
 * Com token (env BRAPI_TOKEN), limite sobe para ~5000/dia (plano gratuito).
 *
 * Estratégia:
 *  - Cache via Next fetch revalidate de 60s (cotação não muda tão rápido)
 *  - Fallback silencioso se a API falhar ou estourar limite
 *  - timeout de 4s pra não travar o SSR
 */

const ENDPOINT = "https://brapi.dev/api/quote";

export type Quote = {
  symbol: string;
  regularMarketPrice: number;
  regularMarketChangePercent: number;
  regularMarketTime?: string;
  longName?: string;
  currency?: string;
};

type RawResponse = {
  results?: Array<{
    symbol: string;
    regularMarketPrice?: number;
    regularMarketChangePercent?: number;
    regularMarketTime?: string;
    longName?: string;
    currency?: string;
  }>;
  error?: string;
};

/**
 * Busca cotações de uma lista de tickers da B3.
 * Retorna Map<ticker_upper, Quote>. Tickers sem cotação ficam fora do map.
 */
export async function fetchQuotes(
  tickers: string[],
  opts?: { token?: string },
): Promise<Map<string, Quote>> {
  const tickersClean = Array.from(new Set(tickers.map((t) => t.trim().toUpperCase()))).filter(
    Boolean,
  );
  if (tickersClean.length === 0) return new Map();

  const token = opts?.token ?? process.env.BRAPI_TOKEN ?? "";
  const url = new URL(`${ENDPOINT}/${tickersClean.join(",")}`);
  if (token) url.searchParams.set("token", token);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      next: { revalidate: 60 }, // cache de 60s
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);

    if (!res.ok) return new Map();
    const json = (await res.json()) as RawResponse;
    if (!json.results) return new Map();

    const map = new Map<string, Quote>();
    for (const r of json.results) {
      if (typeof r.regularMarketPrice !== "number") continue;
      map.set(r.symbol.toUpperCase(), {
        symbol: r.symbol.toUpperCase(),
        regularMarketPrice: r.regularMarketPrice,
        regularMarketChangePercent: r.regularMarketChangePercent ?? 0,
        regularMarketTime: r.regularMarketTime,
        longName: r.longName,
        currency: r.currency,
      });
    }
    return map;
  } catch {
    return new Map();
  }
}

/**
 * Heurística: ticker da B3 é 4 letras + 1-2 dígitos (PETR4, MXRF11, BOVA11).
 * Filtra os ativos da carteira que podem ser cotados.
 */
export function isB3Ticker(s: string): boolean {
  return /^[A-Z]{4}\d{1,2}$/i.test(s.trim());
}
