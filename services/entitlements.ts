import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";
import {
  getPlan,
  PLANS,
  type PlanLimits,
  type PlanFeatures,
} from "@/lib/billing/plans";
import { isBillingEnabled } from "@/lib/stripe";

/**
 * Entitlements — a camada central que decide o que um household pode fazer,
 * a partir do tier + status da assinatura. É o ÚNICO lugar consultado pelos
 * gates de feature/limite.
 *
 * Princípio "engatilhado": com o billing DESLIGADO (sem Stripe), tudo fica
 * liberado — o app se comporta como hoje (uso pessoal do dono, sem cobrança).
 * O gating só passa a valer quando o billing é ligado.
 */

export interface Entitlements {
  tier: string;
  status: string;
  limits: PlanLimits;
  features: PlanFeatures;
  /** App em modo somente-leitura (assinatura suspensa por inadimplência). */
  readOnly: boolean;
  trialEndsAt: string | null;
  /** Billing está ligado? (controla se gating/enforcement valem) */
  billingEnabled: boolean;
}

const UNLIMITED: PlanLimits = {
  maxAccounts: Infinity,
  maxMembers: Infinity,
  maxFilers: Infinity,
  aiMonthlyBudgetCents: Infinity,
};
const ALL_FEATURES: PlanFeatures = {
  ai: true,
  multiCurrency: true,
  accountant: true,
  advancedReports: true,
};

/** Resolve as features/limites de um tier (lifetime = nível Família). */
function resolveTier(tier: string): { limits: PlanLimits; features: PlanFeatures } {
  if (tier === "lifetime") {
    return { limits: PLANS.family.limits, features: PLANS.family.features };
  }
  const plan = getPlan(tier);
  return { limits: plan.limits, features: plan.features };
}

export const getEntitlements = cache(async (): Promise<Entitlements> => {
  const billingEnabled = isBillingEnabled();

  // Billing desligado → tudo liberado (comportamento atual, sem gating).
  if (!billingEnabled) {
    return {
      tier: "owner",
      status: "active",
      limits: UNLIMITED,
      features: ALL_FEATURES,
      readOnly: false,
      trialEndsAt: null,
      billingEnabled: false,
    };
  }

  const ctx = await getCurrentUserContext();
  if (!ctx) {
    return {
      tier: "free",
      status: "inactive",
      ...resolveTier("free"),
      readOnly: false,
      trialEndsAt: null,
      billingEnabled: true,
    };
  }

  const supabase = await createClient();
  const { data: hh } = await supabase
    .from("households")
    .select("subscription_tier, subscription_status, trial_ends_at")
    .eq("id", ctx.household.id)
    .maybeSingle();

  const tier = hh?.subscription_tier ?? "free";
  const status = hh?.subscription_status ?? "active";
  const { limits, features } = resolveTier(tier);

  // Suspenso por inadimplência → somente-leitura (D19). past_due durante o
  // grace continua escrevendo; o cron de dunning vira suspended depois.
  const readOnly = status === "suspended";

  return {
    tier,
    status,
    limits,
    features,
    readOnly,
    trialEndsAt: hh?.trial_ends_at ?? null,
    billingEnabled: true,
  };
});

/** Erro de gating — capturado pelas actions pra mostrar upsell. */
export class EntitlementError extends Error {
  readonly kind: "feature" | "limit" | "read_only";
  constructor(kind: "feature" | "limit" | "read_only", message: string) {
    super(message);
    this.name = "EntitlementError";
    this.kind = kind;
  }
}

/** Bloqueia escrita quando a assinatura está suspensa (mas nunca a leitura). */
export async function assertWritable(): Promise<void> {
  const ent = await getEntitlements();
  if (ent.readOnly) {
    throw new EntitlementError(
      "read_only",
      "Sua assinatura está suspensa por pagamento pendente. Regularize pra voltar a editar — seus dados continuam acessíveis e exportáveis.",
    );
  }
}

/** Exige uma feature do plano; lança EntitlementError se ausente. */
export async function assertFeature(feature: keyof PlanFeatures): Promise<void> {
  const ent = await getEntitlements();
  if (!ent.features[feature]) {
    throw new EntitlementError("feature", `Recurso disponível em um plano superior.`);
  }
}

/** True se a feature está liberada (sem lançar) — pra esconder UI. */
export async function hasFeature(feature: keyof PlanFeatures): Promise<boolean> {
  const ent = await getEntitlements();
  return ent.features[feature];
}
