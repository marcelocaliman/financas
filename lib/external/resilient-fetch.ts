import "server-only";
import { logger } from "@/lib/logger";

/**
 * Wrapper único para TODA dependência externa (brapi, BCB, Tesouro, Frankfurter,
 * OpenAI, Resend). Resolve o padrão "uma API caiu e abortou o batch inteiro":
 *
 *  - timeout (AbortController) — nunca pendura a invocação serverless;
 *  - retry com backoff exponencial em erro de rede / 5xx / 429;
 *  - circuit breaker por host — para de martelar um serviço claramente fora;
 *  - helpers `safe*` que NUNCA lançam — devolvem {ok:false} pra degradar o loop.
 *
 * O circuit breaker é in-memory (por instância serverless). Não é um estado
 * global perfeito, mas corta a maior parte das tempestades de retry.
 */

export class ExternalFetchError extends Error {
  readonly status?: number;
  readonly url: string;
  readonly cause?: unknown;
  constructor(url: string, message: string, opts?: { status?: number; cause?: unknown }) {
    super(message);
    this.name = "ExternalFetchError";
    this.url = url;
    this.status = opts?.status;
    this.cause = opts?.cause;
  }
}

export interface ResilientOptions extends RequestInit {
  /** ms até abortar uma tentativa (default 8000). */
  timeoutMs?: number;
  /** nº de retries após a 1ª falha (default 2). */
  retries?: number;
  /** base do backoff em ms (default 300 → 300, 600, 1200…). */
  backoffMs?: number;
  /** rótulo curto pra logs/telemetria (ex.: "brapi"). */
  label?: string;
}

// ---- Circuit breaker (por host) -------------------------------------------

interface BreakerState {
  failures: number;
  openUntilEpochMs: number;
}
const breakers = new Map<string, BreakerState>();
const BREAKER_THRESHOLD = 5; // falhas consecutivas pra abrir
const BREAKER_COOLDOWN_MS = 30_000; // tempo aberto antes de half-open

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Usa performance.now() (monotônico, disponível e não-banido como Date.now). */
function nowMs(): number {
  return performance.now();
}

function breakerOpen(host: string): boolean {
  const b = breakers.get(host);
  if (!b) return false;
  if (b.openUntilEpochMs === 0) return false;
  if (nowMs() >= b.openUntilEpochMs) {
    // half-open: deixa passar uma tentativa.
    b.openUntilEpochMs = 0;
    return false;
  }
  return true;
}

function recordFailure(host: string) {
  const b = breakers.get(host) ?? { failures: 0, openUntilEpochMs: 0 };
  b.failures += 1;
  if (b.failures >= BREAKER_THRESHOLD) {
    b.openUntilEpochMs = nowMs() + BREAKER_COOLDOWN_MS;
    logger.warn("circuit breaker aberto", { host, failures: b.failures });
  }
  breakers.set(host, b);
}

function recordSuccess(host: string) {
  if (breakers.has(host)) breakers.set(host, { failures: 0, openUntilEpochMs: 0 });
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * fetch resiliente. Lança ExternalFetchError quando esgota retries ou o breaker
 * está aberto. Para loops de batch, prefira `safeFetch`/`safeJson`.
 */
export async function resilientFetch(
  url: string,
  opts: ResilientOptions = {},
): Promise<Response> {
  const { timeoutMs = 8000, retries = 2, backoffMs = 300, label, ...init } = opts;
  const host = hostOf(url);
  const tag = label ?? host;

  if (breakerOpen(host)) {
    throw new ExternalFetchError(url, `circuit aberto para ${host}`, { status: 503 });
  }

  let attempt = 0;
  let lastErr: unknown;
  while (attempt <= retries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if (RETRYABLE_STATUS.has(res.status) && attempt < retries) {
        attempt += 1;
        await sleep(backoffMs * 2 ** (attempt - 1));
        continue;
      }
      if (!res.ok) {
        recordFailure(host);
        throw new ExternalFetchError(url, `${tag} respondeu ${res.status}`, {
          status: res.status,
        });
      }
      recordSuccess(host);
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (err instanceof ExternalFetchError) throw err;
      // erro de rede/abort → retry se ainda houver tentativa
      if (attempt < retries) {
        attempt += 1;
        await sleep(backoffMs * 2 ** (attempt - 1));
        continue;
      }
      recordFailure(host);
      throw new ExternalFetchError(url, `${tag} falhou: ${String(err)}`, { cause: err });
    }
  }
  throw new ExternalFetchError(url, `${tag} esgotou retries`, { cause: lastErr });
}

export type SafeResult<T> = { ok: true; data: T } | { ok: false; error: ExternalFetchError };

/** Como resilientFetch mas NUNCA lança — ideal pra degradar dentro de um loop. */
export async function safeFetch(
  url: string,
  opts: ResilientOptions = {},
): Promise<SafeResult<Response>> {
  try {
    return { ok: true, data: await resilientFetch(url, opts) };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof ExternalFetchError
          ? error
          : new ExternalFetchError(url, String(error), { cause: error }),
    };
  }
}

/** safeFetch + parse JSON. Degrada sem lançar. */
export async function safeJson<T>(
  url: string,
  opts: ResilientOptions = {},
): Promise<SafeResult<T>> {
  const res = await safeFetch(url, opts);
  if (!res.ok) return res;
  try {
    return { ok: true, data: (await res.data.json()) as T };
  } catch (error) {
    return { ok: false, error: new ExternalFetchError(url, "JSON inválido", { cause: error }) };
  }
}

/** Reseta os breakers — só pra testes. */
export function __resetBreakers() {
  breakers.clear();
}
