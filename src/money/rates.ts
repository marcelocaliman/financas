import { CURRENCIES, DEFAULT_RATES, type Currency, type RateTable } from "./currency";

/**
 * Cotação de câmbio — Frankfurter (frankfurter.dev): gratuita, SEM token, taxas de
 * referência do BCE atualizadas em dias úteis. Módulo PURO/testável: monta a RateTable
 * (cada moeda expressa em BRL; BRL = 1) a partir da resposta. Sem dado do usuário sai
 * daqui — só pares de moeda públicos. brapi (com token) fica pra cotação de ATIVOS depois.
 */

// frankfurter.app foi descontinuado e agora só faz 301 → frankfurter.dev/v1; o redirect
// cai numa origem FORA do connect-src (CSP) e o fetch morre em produção. Apontar direto.
const ENDPOINT = "https://api.frankfurter.dev/v1/latest";
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
  const data = (await res.json()) as FrankfurterResponse;
  // Guarda contra mudança SILENCIOSA de forma/base (a inversão 1/perBase assume base=BRL):
  // sem isto, uma base trocada produziria taxas plausíveis porém erradas, sem erro HTTP.
  if (data.base && data.base !== BASE) throw new Error(`câmbio base inesperada: ${data.base}`);
  if (!data.rates || typeof data.rates !== "object") throw new Error("câmbio sem taxas");
  return ratesFromFrankfurter(data);
}

interface FrankfurterSeries {
  rates?: Record<string, Record<string, number>>;
}

/**
 * Série temporal do Frankfurter ({ "2024-01-02": {USD,…}, … }) → lista [{date, rates}] ordenada
 * por data crescente, cada dia já como RateTable (BRL = 1). PURA/testável.
 */
export function seriesFromFrankfurter(data: FrankfurterSeries): { date: string; rates: RateTable }[] {
  const days = data.rates ?? {};
  return Object.keys(days)
    .sort()
    .map((date) => ({ date, rates: ratesFromFrankfurter({ rates: days[date] }) }));
}

/**
 * Últimos dias úteis de câmbio (janela de `lookbackDays`) — usado pra pegar o fechamento de hoje
 * + o anterior e calcular a variação do dia. Só pares públicos; nenhum dado do usuário sai daqui.
 */
export async function fetchRatesSeries(
  lookbackDays = 8,
  signal?: AbortSignal,
): Promise<{ date: string; rates: RateTable }[]> {
  const symbols = CURRENCIES.filter((c) => c !== BASE).join(",");
  const end = new Date();
  const start = new Date(end.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const res = await fetch(`https://api.frankfurter.dev/v1/${fmt(start)}..${fmt(end)}?base=${BASE}&symbols=${symbols}`, { signal });
  if (!res.ok) throw new Error(`câmbio série HTTP ${res.status}`);
  return seriesFromFrankfurter((await res.json()) as FrankfurterSeries);
}

/**
 * TTL de 6h. Frankfurter = taxa de REFERÊNCIA do BCE, publicada ~1×/dia útil (~16h CET); não muda
 * intraday, então poll de minuto seria inútil. 6h só garante pegar a taxa nova do dia com folga
 * (revalida no boot/foco/rede + heartbeat). Grátis, sem token, por-IP — sem cota mensal.
 */
export const RATES_TTL_MS = 6 * 60 * 60 * 1000;

export function isStale(updatedAt: number | null, now: number): boolean {
  return updatedAt == null || now - updatedAt > RATES_TTL_MS;
}
