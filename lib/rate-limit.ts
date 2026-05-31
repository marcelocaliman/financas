import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

/**
 * Rate-limit / cota — wrapper sobre a RPC atômica `consume_rate_limit` (Postgres).
 * Fundação compartilhada por cota de IA, throttle de auth e proteção de rotas
 * que proxyam APIs pagas. Sem infra externa (decisão D1 do ROADMAP).
 *
 * Uso típico:
 *   const r = await rateLimit({ key: aiKey(householdId, "run-audit"), limit: 20, windowSeconds: 86400 });
 *   if (!r.allowed) throw new RateLimitError(r);
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** ISO timestamp em que a janela reseta. */
  resetAt: string;
}

export interface RateLimitOptions {
  /** Chave única identidade+ação. Use os helpers de key abaixo. */
  key: string;
  /** Máximo de unidades por janela. */
  limit: number;
  /** Tamanho da janela em segundos. */
  windowSeconds: number;
  /** Quantas unidades este request consome (default 1). */
  cost?: number;
}

export class RateLimitError extends Error {
  readonly result: RateLimitResult;
  constructor(result: RateLimitResult) {
    super("Limite de uso atingido. Tente novamente mais tarde.");
    this.name = "RateLimitError";
    this.result = result;
  }
}

/**
 * Consome cota. Fail-OPEN: se a RPC falhar (banco indisponível), libera e loga
 * — um limiter que derruba o app é pior que um limiter que vaza num incidente.
 */
export async function rateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  const { key, limit, windowSeconds, cost = 1 } = opts;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("consume_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
      p_cost: cost,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("consume_rate_limit: resposta vazia");
    return {
      allowed: Boolean(row.allowed),
      remaining: Number(row.remaining ?? 0),
      resetAt: String(row.reset_at),
    };
  } catch (err) {
    logger.warn("rate-limit indisponível — liberando (fail-open)", { key });
    logger.error("rate-limit RPC falhou", err, { key });
    return { allowed: true, remaining: limit, resetAt: new Date(0).toISOString() };
  }
}

/** Consome e lança RateLimitError se bloqueado. Açúcar pra rotas/actions. */
export async function enforceRateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  const r = await rateLimit(opts);
  if (!r.allowed) throw new RateLimitError(r);
  return r;
}

// ---- Helpers de chave (mantêm o formato consistente) ----------------------

/** Cota de IA por household + ação. Ex.: ai("run-audit", hhId). */
export function aiKey(action: string, householdId: string): string {
  return `ai:${action}:hh:${householdId}`;
}

/** Throttle de rota pública por IP + rota. */
export function ipKey(route: string, ip: string): string {
  return `ip:${route}:${ip}`;
}

/** Throttle de ação de auth por identificador (email/ip). */
export function authKey(action: string, identifier: string): string {
  return `auth:${action}:${identifier}`;
}
