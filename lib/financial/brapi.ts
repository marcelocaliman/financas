/**
 * brapi.dev — cotações em tempo real da B3 (FIIs, ações, ETFs).
 *
 * Estratégia em camadas pra ficar dentro do plano free (15k req/mês):
 *
 *   L1: cache HTTP do Next (60s) — quando vários components renderizam
 *   L2: snapshot persistente em public.quote_snapshots (TTL adaptativo)
 *   L3: chamada real ao brapi.dev
 *
 * Janela de cache muda conforme horário do mercado (America/Sao_Paulo):
 *   - 10h-18h seg-sex      : 120s  (pregão, sensação ao vivo)
 *   - 08h-10h e 18h-22h     : 600s  (pré/pós, preço quase parado)
 *   - madrugada             : 3600s
 *   - fim de semana         : 43200s (12h, mercado fechado)
 *
 * Projeção de uso com cache atual:
 *   pregão: 8h × 60min / 2min = 240 reqs/dia útil → 22 × 240 = 5.280/mês
 *   demais: ~1.200/mês
 *   total: ~6.500 req/mês = ~43% do limite (15k). Sobra confortável.
 *
 * Se brapi falhar OU der erro de quota, retornamos o snapshot stale —
 * pior cenário é cotação um pouco velha, mas a UI não trava.
 */

import { createClient as createSupabase } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

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

/* ============================== HEURÍSTICAS ============================== */

export function isB3Ticker(s: string): boolean {
  return /^[A-Z]{4}\d{1,2}$/i.test(s.trim());
}

/**
 * Retorna o TTL (em segundos) de validade de um snapshot, baseado no horário
 * atual em America/Sao_Paulo.
 */
export function marketCacheTTL(now: Date = new Date()): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hour12: false,
    hour: "2-digit",
    weekday: "short",
  });
  const parts = fmt.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";

  const isWeekend = weekday === "Sat" || weekday === "Sun";
  if (isWeekend) return 43200; // 12h

  if (hour >= 10 && hour < 18) return 120; // pregão
  if ((hour >= 8 && hour < 10) || (hour >= 18 && hour < 22)) return 600; // pré/pós
  return 3600; // madrugada
}

/* ============================== HTTP RAW ================================= */

/**
 * Chamada bruta ao brapi.dev. Use apenas via fetchQuotesSmart, que adiciona a
 * camada de snapshot. Cache HTTP do Next em 60s pra deduplicar chamadas em
 * renders concorrentes.
 */
async function fetchOneQuote(ticker: string): Promise<Quote | null> {
  const token = process.env.BRAPI_TOKEN ?? "";
  const url = new URL(`${ENDPOINT}/${ticker}`);
  if (token) url.searchParams.set("token", token);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      next: { revalidate: 60 },
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);

    if (!res.ok) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[brapi] HTTP ${res.status} pra ${ticker}`);
      }
      return null;
    }
    const json = (await res.json()) as RawResponse;
    if (!json.results || json.results.length === 0) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[brapi] sem results pra ${ticker}: ${(json as { message?: string }).message ?? json.error ?? "?"}`,
        );
      }
      return null;
    }
    const r = json.results[0];
    if (typeof r.regularMarketPrice !== "number") return null;
    return {
      symbol: r.symbol.toUpperCase(),
      regularMarketPrice: r.regularMarketPrice,
      regularMarketChangePercent: r.regularMarketChangePercent ?? 0,
      regularMarketTime: r.regularMarketTime,
      longName: r.longName,
      currency: r.currency,
    };
  } catch {
    return null;
  }
}

/**
 * Chamada bruta ao brapi.dev. brapi free permite só 1 ticker por requisição —
 * então fazemos N chamadas paralelas (uma por ticker). O cache HTTP do Next
 * (60s) + cache L2 em snapshot mantêm o volume baixo.
 *
 * Budget de requisições (free 15k/mês):
 *   - Cron 2x/dia × N tickers × 22 dias úteis = 44N/mês
 *   - Usuários abrindo (~10x/dia × N × 22) = 220N/mês
 *   - Pra N=10 tickers: ~2.640/mês = 18% do limite. Confortável.
 */
async function fetchQuotesRaw(tickers: string[]): Promise<Map<string, Quote>> {
  if (tickers.length === 0) return new Map();
  const results = await Promise.all(tickers.map((t) => fetchOneQuote(t)));
  const map = new Map<string, Quote>();
  for (const q of results) {
    if (q) map.set(q.symbol, q);
  }
  return map;
}

/* ============================== SMART (com cache L2) ===================== */

/**
 * Tipo do snapshot persistido (espelho de public.quote_snapshots).
 */
type Snapshot = {
  ticker: string;
  price: number;
  change_pct: number | null;
  long_name: string | null;
  currency: string | null;
  fetched_at: string;
};

function snapshotToQuote(s: Snapshot): Quote {
  return {
    symbol: s.ticker.toUpperCase(),
    regularMarketPrice: Number(s.price),
    regularMarketChangePercent: s.change_pct == null ? 0 : Number(s.change_pct),
    longName: s.long_name ?? undefined,
    currency: s.currency ?? undefined,
  };
}

/**
 * Cliente Supabase com SERVICE ROLE — usado APENAS aqui pra ler/escrever a
 * tabela quote_snapshots independente da sessão do usuário. O service role
 * só roda server-side; nunca é exposto ao client.
 */
function serviceClient() {
  return createSupabase<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

/**
 * Busca cotações com estratégia em camadas:
 *  1. Lê snapshots existentes
 *  2. Filtra fresh (dentro do TTL) → retorna direto
 *  3. Stale + faltantes → chama brapi, upserta snapshots, retorna
 *  4. Se brapi falhar, usa snapshots stale como fallback
 */
export async function fetchQuotes(tickers: string[]): Promise<Map<string, Quote>> {
  const tickersClean = Array.from(
    new Set(tickers.map((t) => t.trim().toUpperCase())),
  ).filter(isB3Ticker);
  if (tickersClean.length === 0) return new Map();

  const supabase = serviceClient();
  const ttlSeconds = marketCacheTTL();
  const cutoff = new Date(Date.now() - ttlSeconds * 1000).toISOString();

  // 1. Lê snapshots existentes pros tickers pedidos
  const { data: snaps } = await supabase
    .from("quote_snapshots")
    .select("ticker, price, change_pct, long_name, currency, fetched_at")
    .in("ticker", tickersClean);

  const snapByTicker = new Map<string, Snapshot>();
  for (const s of (snaps ?? []) as Snapshot[]) {
    snapByTicker.set(s.ticker.toUpperCase(), s);
  }

  const result = new Map<string, Quote>();
  const staleTickers: string[] = [];

  for (const ticker of tickersClean) {
    const snap = snapByTicker.get(ticker);
    if (snap && snap.fetched_at > cutoff) {
      // Fresh: serve do snapshot, zero req
      result.set(ticker, snapshotToQuote(snap));
    } else {
      staleTickers.push(ticker);
    }
  }

  // 2. Se há stales, chama brapi (já é 1 ticker por request, paralelizado)
  if (staleTickers.length > 0) {
    const fresh = await fetchQuotesRaw(staleTickers);

    if (fresh.size > 0) {
      // Upsert dos novos valores no snapshot pra próximas leituras
      const upserts = Array.from(fresh.values()).map((q) => ({
        ticker: q.symbol,
        price: q.regularMarketPrice,
        change_pct: q.regularMarketChangePercent,
        long_name: q.longName ?? null,
        currency: q.currency ?? null,
        fetched_at: new Date().toISOString(),
      }));
      await supabase.from("quote_snapshots").upsert(upserts, { onConflict: "ticker" });

      for (const [k, v] of fresh) result.set(k, v);
    }

    // 3. Pros tickers que brapi não devolveu (erro, quota, novo ticker), usa
    //    snapshot stale como fallback. Pior cenário: cotação antiga, melhor que nada.
    for (const ticker of staleTickers) {
      if (!result.has(ticker)) {
        const stale = snapByTicker.get(ticker);
        if (stale) {
          result.set(ticker, snapshotToQuote(stale));
        } else if (process.env.NODE_ENV !== "production") {
          // Log apenas em dev: ajuda a diagnosticar WEGE3-like silenciosos.
          console.warn(`[brapi] sem cotação nem snapshot para ${ticker}`);
        }
      }
    }
  }

  return result;
}
