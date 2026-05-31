import * as Sentry from "@sentry/nextjs";

/**
 * Logger estruturado central.
 *
 * Antes: `console.error` solto e dezenas de `catch {}` silenciosos — erro em
 * produção morria sem rastro. Agora todo erro passa por aqui: vira log
 * estruturado E (se Sentry estiver ligado) um evento com escopo de
 * user/household. Sem DSN, as chamadas do Sentry são no-op seguras.
 *
 * REGRA: nunca logar PII financeira crua (valores, CPF, e-mail). O `redact`
 * abaixo mascara as chaves sensíveis conhecidas antes de qualquer envio.
 */

type Level = "debug" | "info" | "warn" | "error";
type Context = Record<string, unknown>;

const SENSITIVE_KEYS = new Set([
  "password",
  "senha",
  "token",
  "secret",
  "apikey",
  "api_key",
  "authorization",
  "cpf",
  "cnpj",
  "email",
  "e_mail",
  "amount",
  "valor",
  "balance",
  "saldo",
  "access_token",
  "refresh_token",
  "service_role_key",
  "stripe_secret_key",
]);

/** Mascara chaves sensíveis recursivamente (profundidade limitada). */
export function redact(input: unknown, depth = 0): unknown {
  if (depth > 4 || input == null) return input;
  if (Array.isArray(input)) return input.map((v) => redact(v, depth + 1));
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Context)) {
      out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? "[redacted]" : redact(v, depth + 1);
    }
    return out;
  }
  return input;
}

const isProd = process.env.NODE_ENV === "production";

function emit(level: Level, message: string, context?: Context, error?: unknown) {
  const safe = context ? (redact(context) as Context) : undefined;

  // Console: JSON em prod (parseável por log drains), legível em dev.
  if (!isProd) {
    const tag = `[${level.toUpperCase()}]`;
    if (level === "error") console.error(tag, message, safe ?? "", error ?? "");
    else if (level === "warn") console.warn(tag, message, safe ?? "");
    else console.log(tag, message, safe ?? "");
  } else {
    const line = JSON.stringify({
      level,
      message,
      ...safe,
      ts: undefined, // o coletor carimba; evita Date.now() aqui
    });
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  }

  // Sentry: erros e warnings viram eventos (no-op se DSN ausente).
  if (level === "error") {
    if (error !== undefined) {
      Sentry.captureException(error, { extra: safe, tags: { logger: "true" } });
    } else {
      Sentry.captureMessage(message, { level: "error", extra: safe });
    }
  } else if (level === "warn") {
    Sentry.captureMessage(message, { level: "warning", extra: safe });
  }
}

export interface Logger {
  debug(message: string, context?: Context): void;
  info(message: string, context?: Context): void;
  warn(message: string, context?: Context): void;
  error(message: string, error?: unknown, context?: Context): void;
  /** Liga um escopo fixo (ex.: { cron: "update-rates" }) a todos os logs. */
  child(scope: Context): Logger;
}

function make(base: Context): Logger {
  const merge = (c?: Context) => ({ ...base, ...c });
  return {
    debug: (m, c) => emit("debug", m, merge(c)),
    info: (m, c) => emit("info", m, merge(c)),
    warn: (m, c) => emit("warn", m, merge(c)),
    error: (m, e, c) => emit("error", m, merge(c), e),
    child: (scope) => make({ ...base, ...scope }),
  };
}

export const logger: Logger = make({});

/**
 * Liga o escopo de usuário/household no Sentry da request atual.
 * Chamar no início de server actions / handlers autenticados.
 */
export function setLogScope(scope: { userId?: string; householdId?: string }) {
  if (!scope.userId && !scope.householdId) return;
  Sentry.setUser(scope.userId ? { id: scope.userId } : null);
  if (scope.householdId) Sentry.setTag("household_id", scope.householdId);
}
