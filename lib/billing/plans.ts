/**
 * Catálogo de planos e ENTITLEMENTS — a fonte única da verdade do que cada tier
 * libera. Puro e sem IO (testável). Os preços aqui são só pra display; quem
 * cobra é o Stripe (price IDs vêm de env vars). Decisões D17–D19 do ROADMAP.
 *
 * Ajustar plano = mexer aqui (limites/features) + criar o price no Stripe e
 * apontar o env. Nenhum outro lugar decide acesso.
 */

export type PlanTier = "free" | "pro" | "family";

/** Limites numéricos por plano. Infinity = ilimitado. */
export interface PlanLimits {
  maxAccounts: number;
  maxMembers: number;
  maxFilers: number;
  /** Orçamento mensal de IA por household, em centavos. 0 = sem IA. */
  aiMonthlyBudgetCents: number;
}

/** Features booleanas por plano. */
export interface PlanFeatures {
  ai: boolean;
  multiCurrency: boolean;
  accountant: boolean;
  advancedReports: boolean;
}

export interface PlanDef {
  tier: PlanTier;
  name: string;
  /** Preço mensal em BRL pra display (null = grátis). */
  priceMonthlyBRL: number | null;
  /** Nome da env var com o Stripe price id (null = sem cobrança). */
  stripePriceEnv: string | null;
  limits: PlanLimits;
  features: PlanFeatures;
  /** Resumo pra a página de planos. */
  blurb: string;
  highlights: string[];
}

export const TRIAL_DAYS = 14;

export const PLANS: Record<PlanTier, PlanDef> = {
  free: {
    tier: "free",
    name: "Gratuito",
    priceMonthlyBRL: null,
    stripePriceEnv: null,
    limits: { maxAccounts: 3, maxMembers: 1, maxFilers: 1, aiMonthlyBudgetCents: 0 },
    features: { ai: false, multiCurrency: false, accountant: false, advancedReports: false },
    blurb: "Pra começar a organizar as finanças e o IR do jeito manual.",
    highlights: ["Até 3 contas", "1 pessoa", "Cálculo de IR automático", "Sem IA"],
  },
  pro: {
    tier: "pro",
    name: "Pro",
    priceMonthlyBRL: 19,
    stripePriceEnv: "STRIPE_PRICE_PRO_MONTHLY",
    limits: { maxAccounts: Infinity, maxMembers: 2, maxFilers: 2, aiMonthlyBudgetCents: 500 },
    features: { ai: true, multiCurrency: true, accountant: true, advancedReports: true },
    blurb: "Tudo liberado pra um declarante (ou casal) que leva a sério.",
    highlights: [
      "Contas ilimitadas",
      "Multimoeda",
      "Leitura de documentos por IA",
      "Acesso do contador",
      "Relatórios avançados",
    ],
  },
  family: {
    tier: "family",
    name: "Família",
    priceMonthlyBRL: 39,
    stripePriceEnv: "STRIPE_PRICE_FAMILY_MONTHLY",
    limits: { maxAccounts: Infinity, maxMembers: 6, maxFilers: 4, aiMonthlyBudgetCents: 1500 },
    features: { ai: true, multiCurrency: true, accountant: true, advancedReports: true },
    blurb: "Pra a família inteira — vários declarantes e membros.",
    highlights: ["Tudo do Pro", "Até 6 membros", "Até 4 declarantes", "Orçamento de IA maior"],
  },
};

/** Planos pagos, na ordem de exibição. */
export const PAID_TIERS: PlanTier[] = ["pro", "family"];

export function getPlan(tier: string | null | undefined): PlanDef {
  if (tier && tier in PLANS) return PLANS[tier as PlanTier];
  return PLANS.free;
}

/** Lê o Stripe price id do plano a partir das env vars (server-only caller). */
export function priceIdFor(tier: PlanTier, env: Record<string, string | undefined>): string | null {
  const plan = PLANS[tier];
  if (!plan.stripePriceEnv) return null;
  return env[plan.stripePriceEnv] ?? null;
}

/** Mapeia um Stripe price id de volta pro tier (usado no webhook). */
export function tierForPriceId(
  priceId: string | null | undefined,
  env: Record<string, string | undefined>,
): PlanTier {
  if (!priceId) return "free";
  for (const tier of PAID_TIERS) {
    if (env[PLANS[tier].stripePriceEnv as string] === priceId) return tier;
  }
  return "free";
}
