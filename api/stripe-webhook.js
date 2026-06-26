/**
 * Webhook do Stripe — fonte de verdade do estado da assinatura. Valida a assinatura
 * com o BODY CRU (bodyParser desligado) e atualiza public.pro_subscriptions via
 * service_role. É o que liga/desliga o is_pro(). Idempotente (deriva o estado do
 * objeto subscription atual). NUNCA recebe dado financeiro do cofre.
 */
import Stripe from "stripe";

export const config = { api: { bodyParser: false } };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://rudpurnhqoffwjaackka.supabase.co";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const stripe = STRIPE_SECRET ? new Stripe(STRIPE_SECRET) : null;

async function rawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

async function sbFetch(path, opts = {}, ms = 6000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(`${SUPABASE_URL}${path}`, {
      ...opts,
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json", ...(opts.headers || {}) },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

// Stripe → nosso CHECK (trialing|active|past_due|canceled|incomplete). Resto = não-Pro.
function mapStatus(s) {
  if (s === "active" || s === "trialing" || s === "past_due" || s === "incomplete") return s;
  return "canceled"; // canceled, unpaid, incomplete_expired, paused
}

async function updateFromSubscription(sub) {
  const userId = sub.metadata && sub.metadata.user_id;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer && sub.customer.id;
  const fields = {
    status: mapStatus(sub.status),
    current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    stripe_subscription_id: sub.id,
    stripe_customer_id: customerId || null,
    price_id: (sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].price && sub.items.data[0].price.id) || null,
    updated_at: new Date().toISOString(),
  };
  if (userId) {
    await sbFetch(`/rest/v1/pro_subscriptions?on_conflict=user_id`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ user_id: userId, ...fields }),
    });
  } else if (customerId) {
    await sbFetch(`/rest/v1/pro_subscriptions?stripe_customer_id=eq.${encodeURIComponent(customerId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(fields),
    });
  }
}

export default async function handler(req, res) {
  if (!stripe || !WEBHOOK_SECRET || !SERVICE_ROLE) {
    res.status(500).end("not_configured");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).end("method_not_allowed");
    return;
  }

  let event;
  try {
    const buf = await rawBody(req);
    const sig = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(buf, sig, WEBHOOK_SECRET);
  } catch (e) {
    res.status(400).end(`bad_signature: ${e && e.message ? e.message : "error"}`);
    return;
  }

  try {
    const t = event.type;
    if (t.startsWith("customer.subscription.")) {
      await updateFromSubscription(event.data.object);
    } else if (t === "invoice.paid" || t === "invoice.payment_failed") {
      const inv = event.data.object;
      if (inv.subscription) {
        const sub = await stripe.subscriptions.retrieve(typeof inv.subscription === "string" ? inv.subscription : inv.subscription.id);
        await updateFromSubscription(sub);
      }
    }
    res.status(200).json({ received: true });
  } catch (e) {
    // Erro transitório → 500 pra Stripe re-tentar (entregas são idempotentes aqui).
    res.status(500).end(`handler_error: ${e && e.message ? e.message : "error"}`);
  }
}
