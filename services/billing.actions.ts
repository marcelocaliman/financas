"use server";

import { env } from "@/lib/env";
import { getStripe, isBillingEnabled } from "@/lib/stripe";
import { getCurrentUserContext } from "@/services/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { priceIdFor, TRIAL_DAYS, type PlanTier } from "@/lib/billing/plans";
import { logger } from "@/lib/logger";

/**
 * Server actions de billing. A fonte da verdade do ESTADO da assinatura é o
 * webhook do Stripe — estas actions só iniciam fluxos (checkout/portal). Elas
 * nunca gravam subscription_tier/status direto.
 */

export type BillingActionState = { url?: string; error?: string };

async function requireBillingAdmin() {
  if (!isBillingEnabled()) {
    return { error: "Billing não está ligado ainda." as const };
  }
  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." as const };
  if (ctx.profile.role !== "admin") {
    return { error: "Só o administrador do household gerencia a assinatura." as const };
  }
  return { ctx };
}

/** Garante um Stripe customer pro household e devolve o id. */
async function ensureCustomer(householdId: string, email: string | null): Promise<string> {
  const supabase = await createClient();
  const { data: hh } = await supabase
    .from("households")
    .select("stripe_customer_id, name")
    .eq("id", householdId)
    .maybeSingle();
  if (hh?.stripe_customer_id) return hh.stripe_customer_id;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: email ?? undefined,
    name: hh?.name ?? undefined,
    metadata: { household_id: householdId },
  });
  // customer_id é referência, não estado de assinatura — pode gravar aqui.
  const admin = createAdminClient();
  await admin.from("households").update({ stripe_customer_id: customer.id }).eq("id", householdId);
  return customer.id;
}

export async function createCheckoutSession(tier: PlanTier): Promise<BillingActionState> {
  const guard = await requireBillingAdmin();
  if ("error" in guard) return { error: guard.error };
  const { ctx } = guard;

  const priceId = priceIdFor(tier, process.env);
  if (!priceId) return { error: `Plano ${tier} sem price configurado no Stripe.` };

  try {
    const customerId = await ensureCustomer(ctx.household.id, ctx.email);
    const stripe = getStripe();
    const base = env.NEXT_PUBLIC_APP_URL;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        metadata: { household_id: ctx.household.id },
      },
      // Fonte da verdade é o webhook; o household_id viaja na metadata.
      metadata: { household_id: ctx.household.id, tier },
      success_url: `${base}/configuracoes/billing?success=1`,
      cancel_url: `${base}/configuracoes/billing?canceled=1`,
      allow_promotion_codes: true,
    });
    if (!session.url) return { error: "Stripe não retornou a URL de checkout." };
    return { url: session.url };
  } catch (e) {
    logger.error("createCheckoutSession falhou", e, { householdId: ctx.household.id, tier });
    return { error: "Não consegui iniciar o checkout. Tente de novo." };
  }
}

export async function createPortalSession(): Promise<BillingActionState> {
  const guard = await requireBillingAdmin();
  if ("error" in guard) return { error: guard.error };
  const { ctx } = guard;

  try {
    const supabase = await createClient();
    const { data: hh } = await supabase
      .from("households")
      .select("stripe_customer_id")
      .eq("id", ctx.household.id)
      .maybeSingle();
    if (!hh?.stripe_customer_id) {
      return { error: "Você ainda não tem uma assinatura ativa." };
    }
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: hh.stripe_customer_id,
      return_url: `${env.NEXT_PUBLIC_APP_URL}/configuracoes/billing`,
    });
    return { url: session.url };
  } catch (e) {
    logger.error("createPortalSession falhou", e, { householdId: ctx.household.id });
    return { error: "Não consegui abrir o portal de cobrança." };
  }
}
