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
// Mesma versão pinada do billing — assim re-buscamos a subscription em formato
// estável (current_period_end no objeto; versões 2025+ moveram p/ items.data[].).
const stripe = STRIPE_SECRET ? new Stripe(STRIPE_SECRET, { apiVersion: "2024-06-20" }) : null;

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
    return;
  }
  if (customerId) {
    // Tenta atualizar a linha existente por customer; pede representação p/ saber se casou.
    const r = await sbFetch(`/rest/v1/pro_subscriptions?stripe_customer_id=eq.${encodeURIComponent(customerId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(fields),
    });
    const patched = r.ok ? await r.json().catch(() => []) : [];
    if (Array.isArray(patched) && patched.length > 0) return;
    // 0 linhas (sub criada fora do app, sem metadata.user_id) → resolve user_id pelo customer.
    let uid = null;
    try {
      const c = await stripe.customers.retrieve(customerId);
      uid = c && !c.deleted ? c.metadata && c.metadata.user_id : null;
    } catch {
      /* segue pro throw abaixo */
    }
    if (uid) {
      await sbFetch(`/rest/v1/pro_subscriptions?on_conflict=user_id`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ user_id: uid, ...fields }),
      });
      return;
    }
    // Sem como firmar → 500 (via throw) pro Stripe re-tentar, em vez de engolir o evento.
    throw new Error("unmapped_subscription_event");
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
    if (t === "customer.subscription.deleted") {
      // Downgrade: usa o PRÓPRIO payload (status canceled). Não depende do re-fetch,
      // que pode dar 404 justo no .deleted (o objeto está sumindo) e travar is_pro em Pro.
      await updateFromSubscription(event.data.object);
    } else if (t.startsWith("customer.subscription.")) {
      // Re-busca via API (pinada) em vez de usar o payload do evento — garante
      // current_period_end e formato consistentes, independentemente da versão do endpoint.
      const subId = event.data.object && event.data.object.id;
      if (subId) {
        try {
          await updateFromSubscription(await stripe.subscriptions.retrieve(subId));
        } catch (e) {
          // sub sumiu (404/resource_missing) → firma o downgrade pelo payload do evento.
          if (e && (e.code === "resource_missing" || e.statusCode === 404)) await updateFromSubscription(event.data.object);
          else throw e;
        }
      }
    } else if (t === "invoice.paid" || t === "invoice.payment_failed") {
      const inv = event.data.object;
      const ref =
        inv.subscription ||
        (inv.parent && inv.parent.subscription_details && inv.parent.subscription_details.subscription) ||
        null;
      const subId = typeof ref === "string" ? ref : ref && ref.id;
      if (subId) await updateFromSubscription(await stripe.subscriptions.retrieve(subId));
    }
    res.status(200).json({ received: true });
  } catch (e) {
    // Erro transitório → 500 pra Stripe re-tentar (entregas são idempotentes aqui).
    res.status(500).end(`handler_error: ${e && e.message ? e.message : "error"}`);
  }
}
