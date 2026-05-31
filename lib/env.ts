import "server-only";
import { z } from "zod";

/**
 * Validação centralizada de variáveis de ambiente — fonte única da verdade.
 *
 * Por quê: até aqui o app lia `process.env.X` espalhado, sem validação. Uma var
 * faltando ou com typo só estourava em runtime, fundo, no primeiro uso (às vezes
 * num cron às 3h). Aqui validamos no boot e falhamos cedo e alto.
 *
 * Filosofia "engatilhado": as integrações externas que o dono ainda não ligou
 * (Stripe, Sentry, Upstash, QStash, Turnstile) são TODAS opcionais no schema.
 * O código que as usa checa `env.STRIPE_SECRET_KEY` etc. e degrada para no-op
 * quando ausente. Ligar = preencher a env var. Nenhuma muda de código.
 *
 * O que é OBRIGATÓRIO: só o núcleo sem o qual o app não funciona (Supabase).
 * Tudo o mais é opcional + validado de formato quando presente.
 *
 * Uso: `import { env } from "@/lib/env"`. NÃO usar em código client (server-only).
 * Para flags públicas no client, use `publicEnv` (só NEXT_PUBLIC_*).
 */

const bool = (def: boolean) =>
  z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((v) => (v === undefined ? def : v === "true" || v === "1"));

const serverSchema = z.object({
  // ----- Núcleo (obrigatório) -------------------------------------------
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // ----- Migrations / CLI (opcional; só pra db:push/db:types localmente) -
  SUPABASE_DB_PASSWORD: z.string().optional(),
  SUPABASE_PROJECT_REF: z.string().optional(),
  SUPABASE_ACCESS_TOKEN: z.string().optional(),

  // ----- Crons ----------------------------------------------------------
  CRON_SECRET: z.string().optional(),
  CRON_ALERT_EMAIL: z.string().email().optional(),

  // ----- E-mail (Resend) ------------------------------------------------
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  NEXT_PUBLIC_CONTACT_EMAIL: z.string().optional(),

  // ----- IA (OpenAI / Anthropic) ----------------------------------------
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  // Orçamento mensal de IA por household, em centavos (default por tier no código).
  MONTHLY_AI_BUDGET_CENTS: z.coerce.number().int().positive().optional(),

  // ----- Dados externos / câmbio ----------------------------------------
  BRAPI_TOKEN: z.string().optional(),
  // Liga a fonte PTAX (BCB) no cron de câmbio para o IR (D14).
  BCB_PTAX_ENABLED: bool(false),

  // ----- Auth hook (Supabase) -------------------------------------------
  SUPABASE_AUTH_HOOK_SECRET: z.string().optional(),

  // ===== ENGATILHADO — ligar preenchendo a chave ========================

  // Billing (Stripe) — pendência única do dono: criar conta + 6 vars.
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_PRO_MONTHLY: z.string().optional(),
  STRIPE_PRICE_FAMILY_MONTHLY: z.string().optional(),
  STRIPE_PRICE_LIFETIME: z.string().optional(),
  NEXT_PUBLIC_STRIPE_BILLING_ENABLED: bool(false),

  // Observabilidade (Sentry) — sem DSN, todo o wiring é no-op.
  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),

  // Rate-limit / cache (Upstash) — só se a decisão for usar edge throttle.
  // O rate-limit do núcleo é por RPC Postgres (D1) e não depende disto.
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Fila de jobs (QStash) — cron → worker por household.
  QSTASH_TOKEN: z.string().optional(),
  QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().optional(),
  JOBS_QUEUE_ENABLED: bool(false),

  // Anti-abuso (captcha Turnstile).
  TURNSTILE_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
  AUTH_RATELIMIT_DISABLED: bool(false),

  // LGPD.
  LGPD_DELETION_GRACE_DAYS: z.coerce.number().int().nonnegative().default(7),
  LGPD_DPO_EMAIL: z.string().email().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

function format(error: z.ZodError): string {
  return error.issues
    .map((i) => `  • ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
}

let cached: ServerEnv | null = null;

/**
 * Valida e devolve o ambiente. Cacheia após o primeiro parse.
 * Em produção, lança no boot se algo obrigatório faltar — fail-fast.
 */
function parseEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg =
      "❌ Variáveis de ambiente inválidas/ausentes:\n" + format(parsed.error);
    // Em prod, derruba o boot. Em dev/test, loga forte mas deixa seguir pra
    // não travar quem está mexendo só num pedaço do app.
    if (process.env.NODE_ENV === "production") {
      throw new Error(msg);
    }
    console.error(msg);
    // Devolve um parse permissivo em dev pra não quebrar o fluxo local.
    cached = serverSchema.partial().parse(process.env) as ServerEnv;
    return cached;
  }
  cached = parsed.data;
  return cached;
}

export const env: ServerEnv = new Proxy({} as ServerEnv, {
  get(_t, prop: string) {
    return parseEnv()[prop as keyof ServerEnv];
  },
});

/** Conjunto de flags derivadas — "esta integração está ligada?". */
export const features = {
  get billing() {
    return Boolean(env.STRIPE_SECRET_KEY) && env.NEXT_PUBLIC_STRIPE_BILLING_ENABLED;
  },
  get sentry() {
    return Boolean(env.SENTRY_DSN || env.NEXT_PUBLIC_SENTRY_DSN);
  },
  get upstash() {
    return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
  },
  get jobQueue() {
    return env.JOBS_QUEUE_ENABLED && Boolean(env.QSTASH_TOKEN);
  },
  get captcha() {
    return Boolean(env.TURNSTILE_SECRET_KEY && env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  },
  get openai() {
    return Boolean(env.OPENAI_API_KEY);
  },
  get email() {
    return Boolean(env.RESEND_API_KEY);
  },
} as const;
