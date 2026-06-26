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
const PRICES = {
  monthly: process.env.STRIPE_PRICE_MONTHLY,
  annual: process.env.STRIPE_PRICE_ANNUAL,
  // Tier "Pro Investidor" (cotação ao vivo) — estrutura pronta, DESLIGADA até a UI oferecer.
  investor_monthly: process.env.STRIPE_PRICE_INVESTOR_MONTHLY,
  investor_annual: process.env.STRIPE_PRICE_INVESTOR_ANNUAL,
};
const ALLOWED_PLANS = ["monthly", "annual", "investor_monthly", "investor_annual"];
// Pina uma versão de API estável: o fluxo embutido usa latest_invoice.payment_intent
// e subscription.current_period_end (versões 2025+ moveram esses campos → quebrava o checkout).
const stripe = STRIPE_SECRET ? new Stripe(STRIPE_SECRET, { apiVersion: "2024-06-20" }) : null;

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
  // FAIL-CLOSED: erro de leitura NÃO pode virar "usuário sem assinatura" — isso
  // levaria a criar customer+assinatura duplicados (cobrança dupla). Propaga o erro.
  if (!r.ok) throw new Error("subrow_read_failed");
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
      const plan = ALLOWED_PLANS.includes(body.plan) ? body.plan : "monthly";
      const price = PRICES[plan];
      if (!price) return json(res, 500, { error: "price_not_configured" });

      let existing;
      try {
        existing = await getSubRow(user.id);
      } catch {
        return json(res, 503, { error: "read_failed" }); // não seguir e arriscar duplicar cobrança
      }

      // Já tem assinatura VIVA no Stripe? Não recriar — recriar cancelaria a legítima.
      if (existing?.stripe_subscription_id && (existing.status === "active" || existing.status === "trialing")) {
        return json(res, 200, { mode: "none", alreadyActive: true, status: existing.status });
      }
      // past_due = renovação falhou: deixa PAGAR a fatura em aberto (nunca recriar/cancelar).
      if (existing?.stripe_subscription_id && existing.status === "past_due") {
        try {
          const cur = await stripe.subscriptions.retrieve(existing.stripe_subscription_id, { expand: ["latest_invoice.payment_intent"] });
          const dpi = cur.latest_invoice && cur.latest_invoice.payment_intent;
          if (dpi && dpi.client_secret) return json(res, 200, { mode: "payment", clientSecret: dpi.client_secret, subscriptionId: cur.id });
        } catch {
          /* cai pro erro abaixo — nunca recriar */
        }
        return json(res, 409, { error: "past_due_unresolved" });
      }

      let customerId = existing?.stripe_customer_id;
      if (!customerId) {
        // idempotencyKey por-usuário → POSTs concorrentes não criam customers duplicados.
        const c = await stripe.customers.create(
          { email: user.email || undefined, metadata: { user_id: user.id } },
          { idempotencyKey: `cust:${user.id}` },
        );
        customerId = c.id;
      }

      // Limpa SÓ assinatura incompleta/cancelada (tentativa sem cartão) — nunca uma paga/trial/past_due.
      if (existing?.stripe_subscription_id && ["incomplete", "canceled"].includes(existing.status)) {
        try {
          await stripe.subscriptions.cancel(existing.stripe_subscription_id);
        } catch {
          /* já cancelada/inexistente — ok */
        }
      }

      // Cobrança IMEDIATA na conversão → sempre gera PaymentIntent (o cartão sempre aparece).
      // idempotencyKey por janela curta (10s) → clique-duplo/2 abas não criam 2 assinaturas.
      const idemWindow = Math.floor(Date.now() / 10000);
      const sub = await stripe.subscriptions.create(
        {
          customer: customerId,
          items: [{ price }],
          payment_behavior: "default_incomplete",
          payment_settings: { save_default_payment_method: "on_subscription" },
          expand: ["latest_invoice.payment_intent"],
          metadata: { user_id: user.id },
        },
        { idempotencyKey: `sub:${user.id}:${plan}:${idemWindow}` },
      );

      await upsertSub({
        user_id: user.id,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        status: ["active", "trialing", "past_due", "incomplete"].includes(sub.status) ? sub.status : "incomplete",
        price_id: price,
        plan,
        trial_started: true, // converter pelo checkout QUEIMA o direito ao trial grátis (anti-abuso)
        current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      });

      const inv = sub.latest_invoice;
      const clientSecret =
        (inv && inv.payment_intent && inv.payment_intent.client_secret) ||
        (inv && inv.confirmation_secret && inv.confirmation_secret.client_secret) ||
        null;
      if (clientSecret) return json(res, 200, { mode: "payment", clientSecret, subscriptionId: sub.id });
      // Sem client secret → FALHA explícita (nunca fingir que virou Pro).
      return json(res, 500, { error: "no_client_secret", status: sub.status });
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
