/**
 * Billing — cria/gerencia a assinatura Pro (Stripe), checkout EMBUTIDO (Payment Element).
 * Autentica pelo JWT do usuário (= /api/quote, /api/ticket). Escreve em pro_subscriptions
 * via service_role. O estado de verdade é firmado pelo webhook (/api/stripe-webhook);
 * aqui só persistimos os ids do Stripe e devolvemos o clientSecret pro front confirmar.
 * NENHUM dado financeiro do cofre passa por aqui — só metadados de assinatura.
 */
import Stripe from "stripe";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://rudpurnhqoffwjaackka.supabase.co";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const PRICES = { monthly: process.env.STRIPE_PRICE_MONTHLY, annual: process.env.STRIPE_PRICE_ANNUAL };
const stripe = STRIPE_SECRET ? new Stripe(STRIPE_SECRET) : null;

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

async function userFromJwt(req) {
  const h = req.headers.authorization || req.headers.Authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m) return null;
  try {
    const r = await sbFetch(`/auth/v1/user`, { headers: { Authorization: `Bearer ${m[1]}` } });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? { id: u.id, email: u.email } : null;
  } catch {
    return null;
  }
}

async function getSubRow(userId) {
  const r = await sbFetch(`/rest/v1/pro_subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=*`);
  if (!r.ok) return null;
  const rows = await r.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

/** Upsert parcial (só atualiza as colunas enviadas; webhook é a autoridade do status). */
async function upsertSub(row) {
  await sbFetch(`/rest/v1/pro_subscriptions?on_conflict=user_id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row),
  });
}

function json(res, code, obj) {
  res.setHeader("Cache-Control", "no-store");
  res.status(code).json(obj);
}

export default async function handler(req, res) {
  if (!stripe || !SERVICE_ROLE) return json(res, 500, { error: "not_configured" });
  if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" });
  const user = await userFromJwt(req);
  if (!user) return json(res, 401, { error: "unauthenticated" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  const action = String((req.query && req.query.action) || "");

  try {
    if (action === "create-subscription") {
      const plan = body.plan === "annual" ? "annual" : "monthly";
      const price = PRICES[plan];
      if (!price) return json(res, 500, { error: "price_not_configured" });

      const existing = await getSubRow(user.id);
      // Só bloqueia se já é PAGANTE ativo (o nosso trial NÃO bloqueia — converter = pagar agora).
      if (existing?.stripe_subscription_id && existing.status === "active") {
        return json(res, 200, { mode: "none", alreadyActive: true, status: "active" });
      }

      let customerId = existing?.stripe_customer_id;
      if (!customerId) {
        const c = await stripe.customers.create({ email: user.email || undefined, metadata: { user_id: user.id } });
        customerId = c.id;
      }

      // Limpa assinatura anterior NÃO-ativa (tentativa incompleta/sem cartão) pra não duplicar.
      if (existing?.stripe_subscription_id) {
        try {
          await stripe.subscriptions.cancel(existing.stripe_subscription_id);
        } catch {
          /* já cancelada/inexistente — ok */
        }
      }

      // Cobrança IMEDIATA na conversão → sempre gera PaymentIntent (o cartão sempre aparece).
      const sub = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price }],
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.payment_intent"],
        metadata: { user_id: user.id },
      });

      await upsertSub({
        user_id: user.id,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        status: ["active", "trialing", "past_due", "incomplete"].includes(sub.status) ? sub.status : "incomplete",
        price_id: price,
        plan,
        current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      });

      const pi = sub.latest_invoice && sub.latest_invoice.payment_intent;
      if (pi && pi.client_secret) return json(res, 200, { mode: "payment", clientSecret: pi.client_secret, subscriptionId: sub.id });
      return json(res, 200, { mode: "none", subscriptionId: sub.id, status: sub.status });
    }

    if (action === "cancel") {
      const existing = await getSubRow(user.id);
      if (!existing?.stripe_subscription_id) return json(res, 400, { error: "no_subscription" });
      const sub = await stripe.subscriptions.update(existing.stripe_subscription_id, { cancel_at_period_end: true });
      await upsertSub({ user_id: user.id, cancel_at_period_end: true, updated_at: new Date().toISOString() });
      return json(res, 200, { status: sub.status, cancel_at_period_end: true });
    }

    if (action === "resume") {
      const existing = await getSubRow(user.id);
      if (!existing?.stripe_subscription_id) return json(res, 400, { error: "no_subscription" });
      const sub = await stripe.subscriptions.update(existing.stripe_subscription_id, { cancel_at_period_end: false });
      await upsertSub({ user_id: user.id, cancel_at_period_end: false, updated_at: new Date().toISOString() });
      return json(res, 200, { status: sub.status, cancel_at_period_end: false });
    }

    return json(res, 400, { error: "unknown_action" });
  } catch (e) {
    return json(res, 500, { error: "stripe_error", message: e && e.message ? e.message : String(e) });
  }
}
