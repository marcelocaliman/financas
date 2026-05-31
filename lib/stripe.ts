import "server-only";
import Stripe from "stripe";
import { env, features } from "@/lib/env";

/**
 * Cliente Stripe server-only. ENGATILHADO: só instancia se STRIPE_SECRET_KEY
 * estiver presente. Sem a chave, `isStripeConfigured()` é false e toda a
 * superfície de billing degrada (a UI esconde, as actions recusam com mensagem
 * clara). Ligar = preencher as env vars do bloco Stripe no .env.
 */

let _stripe: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}

/** Billing realmente ligado (chave + flag pública). */
export function isBillingEnabled(): boolean {
  return features.billing;
}

export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error(
      "Stripe não configurado: preencha STRIPE_SECRET_KEY (e os price IDs) pra ligar o billing.",
    );
  }
  if (!_stripe) {
    _stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      // Sem fixar apiVersion: usa a default da conta, evitando drift de tipos.
      typescript: true,
      appInfo: { name: "Financas", version: "0.1.0" },
    });
  }
  return _stripe;
}
