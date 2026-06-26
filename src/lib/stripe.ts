import { loadStripe, type Stripe } from "@stripe/stripe-js";

let promise: Promise<Stripe | null> | null = null;

/** Carrega o Stripe.js 1× (chave PÚBLICA do env de build). null se não configurado. */
export function getStripe(): Promise<Stripe | null> {
  if (!promise) {
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
    promise = key ? loadStripe(key) : Promise.resolve(null);
  }
  return promise;
}
