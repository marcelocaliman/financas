/**
 * Cotação de ATIVOS — via NOSSO proxy serverless (/api/quote), que guarda o token brapi
 * do dono como variável de ambiente do servidor. O endpoint é EXCLUSIVO do super-admin
 * (uso pessoal do tier free); por isso o fetch envia o JWT da sessão pro servidor confirmar
 * quem é admin. Parser PURO/testável; o fetch monta a URL, anexa o token e delega.
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
 * Agenda de atualização — ECONOMIA DE COTA (brapi free): atualiza só em DIAS DE PREGÃO
 * (seg–sex) e no máximo 4× ao dia, em janelas alinhadas à B3 (pregão 10h–17h, horário de
 * Brasília): abertura, dois no meio e uma após o fechamento (18h). Fim de semana: não atualiza.
 * `force` (incluir/editar ticker) ignora a agenda; o 1º carregamento (updatedAt nulo) também,
 * pra já mostrar o último fechamento.
 *
 * Brasília = UTC−3 fixo (sem horário de verão desde 2019); por isso lemos o relógio de
 * Brasília subtraindo 3h e usando os getters UTC.
 */
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
/** Janelas em horário de Brasília [hora, minuto]. */
export const REFRESH_WINDOWS_BRT: [number, number][] = [
  [10, 30], // abertura
  [12, 30], // meio da manhã
  [14, 30], // meio da tarde
  [18, 0], // após o fechamento (preço de fechamento já consolidado)
];

/** Relógio de Brasília a partir de um timestamp (ler com getUTC*). */
function brtClock(ts: number): Date {
  return new Date(ts - BRT_OFFSET_MS);
}

/**
 * Deve atualizar agora? Verdadeiro se nunca buscou (bootstrap) ou se, num dia de pregão,
 * já passou uma janela do dia ainda não coberta por `updatedAt`. Caps: ≤4/dia útil, 0 no fds.
 */
export function isQuoteRefreshDue(updatedAt: number | null, now: number): boolean {
  if (updatedAt == null) return true; // 1º carregamento: pega o último fechamento
  const b = brtClock(now);
  const weekday = b.getUTCDay(); // 0=Dom … 6=Sáb (em Brasília)
  if (weekday === 0 || weekday === 6) return false; // sem fins de semana
  const y = b.getUTCFullYear();
  const mo = b.getUTCMonth();
  const d = b.getUTCDate();
  const mins = b.getUTCHours() * 60 + b.getUTCMinutes();
  let latest: number | null = null;
  for (const [h, m] of REFRESH_WINDOWS_BRT) {
    if (h * 60 + m <= mins) latest = Date.UTC(y, mo, d, h, m) + BRT_OFFSET_MS;
  }
  if (latest == null) return false; // antes da 1ª janela do dia
  return updatedAt < latest; // ainda não buscou desde a última janela que passou
}
