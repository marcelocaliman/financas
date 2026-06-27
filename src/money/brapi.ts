/**
 * Cotação de ATIVOS — via NOSSO proxy serverless (/api/quote), que guarda os tokens do dono
 * como variáveis de ambiente do servidor. O fetch envia o JWT da sessão pro servidor conferir
 * a permissão (super-admin no free SEMPRE; assinante Pro Investidor com a flag ON). Parser
 * PURO/testável; o fetch monta a URL, anexa o token e delega.
 */
import { supabase } from "@/lib/supabase";

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
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  // Timeout próprio quando o caller não passa signal — nunca deixa o store preso em "loading".
  const ctrl = signal ? null : new AbortController();
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 12000) : null;
  try {
    const res = await fetch(`${ENDPOINT}?tickers=${encodeURIComponent(list.join(","))}`, {
      signal: signal ?? ctrl?.signal,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) throw new Error(`quote HTTP ${res.status}`);
    return parseQuotes((await res.json()) as { results?: BrapiResult[] });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Agenda de atualização — só em DIAS DE PREGÃO (seg–sex) e de HORA EM HORA durante o pregão
 * (10:00–18:15 BRT, cobrindo abertura ao fechamento). MESMA cadência pros dois tiers: admin
 * (brapi free — a cota é larga) e Pro Investidor (pago). Fim de semana: não atualiza. `force`
 * (incluir/editar ticker) ignora a agenda; o 1º carregamento (updatedAt nulo) também, pra já
 * mostrar o último fechamento. Interno: a UI nunca expõe frequência (cotação = "automática").
 * O custo real é blindado no SERVIDOR (cache compartilhado + TTL), não por esta agenda do cliente.
 *
 * Brasília = UTC−3 fixo (sem horário de verão desde 2019); por isso lemos o relógio de
 * Brasília subtraindo 3h e usando os getters UTC.
 */
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Relógio de Brasília a partir de um timestamp (ler com getUTC*). */
function brtClock(ts: number): Date {
  return new Date(ts - BRT_OFFSET_MS);
}

/**
 * Deve atualizar agora? Verdadeiro se nunca buscou (bootstrap) ou se, num dia de pregão e dentro
 * do horário (10:00–18:15 BRT), passou ≥1h da última. Fim de semana / fora do pregão: nunca.
 */
export function isQuoteRefreshDue(updatedAt: number | null, now: number): boolean {
  if (updatedAt == null) return true; // 1º carregamento: pega o último fechamento
  const b = brtClock(now);
  const weekday = b.getUTCDay(); // 0=Dom … 6=Sáb (em Brasília)
  if (weekday === 0 || weekday === 6) return false; // sem fins de semana
  const mins = b.getUTCHours() * 60 + b.getUTCMinutes();
  if (mins < 10 * 60 || mins > 18 * 60 + 15) return false; // fora do pregão
  return now - updatedAt >= 60 * 60 * 1000; // de hora em hora
}
