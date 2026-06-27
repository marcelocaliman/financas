/**
 * /api/waitlist — lista de espera do Pro Investidor (landing), com DOUBLE OPT-IN.
 *
 * POST { email, ts, lang }  → valida email + Turnstile (fail-secure), grava como PENDENTE e envia
 *                             um email de confirmação. Só CONTA como demanda depois de confirmado.
 * GET  ?confirm=<token>     → confirma o email (seta confirmed_at) e devolve uma página de sucesso.
 *
 * Por que double opt-in: prova que o email é real e do próprio dono (anti-spoof de terceiros) e é o
 * padrão LGPD/GDPR de consentimento. Texto claro (não é o cofre E2EE): lista de contato com
 * consentimento, como email_optin/tickets. Escrita só aqui via service_role (a tabela bloqueia
 * anon/authenticated). Dedupe por email (PK). Anti-spam: Turnstile invisível (mesma chave do contato).
 *
 * Env (Vercel): SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, TURNSTILE_SECRET_KEY, RESEND_API_KEY, EMAIL_FROM.
 */
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://rudpurnhqoffwjaackka.supabase.co";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || "Nossas Finanças <nao-responda@nossasfinancas.com.br>";
const SITE = "https://nossasfinancas.com.br";

function json(res, code, obj) {
  res.status(code).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(obj));
}
function htmlPage(res, code, html) {
  res.status(code).setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(html);
}
function parseBody(req) {
  let b = req.body;
  if (typeof b === "string") {
    try {
      b = JSON.parse(b);
    } catch {
      b = {};
    }
  }
  return b || {};
}
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function genToken() {
  const a = new Uint8Array(24);
  if (globalThis.crypto && globalThis.crypto.getRandomValues) globalThis.crypto.getRandomValues(a);
  else for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}
const sbHeaders = {
  apikey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
  "Content-Type": "application/json",
};

/** Turnstile fail-secure: sem segredo configurado OU sem token → false. */
async function verifyTurnstile(token, ip) {
  if (!TURNSTILE_SECRET || !token) return false;
  try {
    const body = new URLSearchParams({ secret: TURNSTILE_SECRET, response: String(token) });
    if (ip) body.set("remoteip", ip);
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const d = await r.json();
    return !!(d && d.success);
  } catch {
    return false;
  }
}

async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY || !to) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
    });
  } catch {
    /* best-effort — e-mail nunca derruba a operação */
  }
}

function confirmEmailHtml(url, lang) {
  const t =
    lang === "en"
      ? { pre: "Almost there!", h: "Confirm your spot on the waitlist", p: "You asked to be notified when Pro Investor launches. Click below to confirm — that's it.", btn: "Confirm my email", foot: "If you didn't request this, just ignore this email." }
      : { pre: "Quase lá!", h: "Confirme sua vaga na lista de espera", p: "Você pediu pra ser avisado quando o Pro Investidor lançar. Clique abaixo pra confirmar — só isso.", btn: "Confirmar meu email", foot: "Se você não pediu isso, é só ignorar este email." };
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
    <p style="color:#15976a;font-weight:600;margin:0 0 4px">${t.pre}</p>
    <h2 style="margin:0 0 12px">${t.h}</h2>
    <p style="color:#444;line-height:1.6">${t.p}</p>
    <p style="margin:24px 0"><a href="${esc(url)}" style="background:#15976a;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">${t.btn}</a></p>
    <p style="color:#888;font-size:12px">${t.foot}</p>
    <p style="color:#aaa;font-size:11px">Nossas Finanças · nossasfinancas.com.br</p>
  </div>`;
}

function resultPageHtml(lang) {
  const t =
    lang === "en"
      ? { title: "Confirmed", h: "You're on the list 🎉", p: "We'll email you the moment Pro Investor goes live. Thanks for the interest!", back: "← Back to the site" }
      : { title: "Confirmado", h: "Você está na lista 🎉", p: "A gente te avisa no minuto que o Pro Investidor entrar no ar. Valeu pelo interesse!", back: "← Voltar ao site" };
  return `<!doctype html><html lang="${lang === "en" ? "en" : "pt-BR"}"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="robots" content="noindex"/><title>${t.title} — Nossas Finanças</title>
<style>body{margin:0;background:#0A0B0D;color:#F3F4F6;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:grid;place-items:center;min-height:100vh}
.box{max-width:420px;text-align:center;padding:32px 24px}.dot{width:54px;height:54px;border-radius:50%;background:rgba(62,207,142,.14);color:#3ECF8E;display:grid;place-items:center;margin:0 auto 18px;font-size:26px;font-weight:700}
h1{font-size:24px;letter-spacing:-.02em;margin:0 0 10px}p{color:#9CA2AC;line-height:1.6;margin:0 0 22px}a{color:#3ECF8E;text-decoration:none}</style></head>
<body><div class="box"><div class="dot">✓</div><h1>${t.h}</h1><p>${t.p}</p><a href="/">${t.back}</a></div></body></html>`;
}

export default async function handler(req, res) {
  // GET ?confirm=<token> → confirma o email (double opt-in) e mostra a página de sucesso.
  if (req.method === "GET") {
    const token = String((req.query && req.query.confirm) || "");
    const lang = (req.query && req.query.lang) === "en" ? "en" : "pt";
    // token é hex (genToken); valida o formato antes de tocar o filtro PostgREST.
    if (SERVICE_ROLE && /^[a-f0-9]{16,64}$/.test(token)) {
      try {
        // Confirma só os PENDENTES desse token (idempotente; clicar 2× não erra). Página é a mesma
        // em qualquer caso — não vaza se o token era válido/expirado.
        await fetch(`${SUPABASE_URL}/rest/v1/investor_waitlist?confirm_token=eq.${token}&confirmed_at=is.null`, {
          method: "PATCH",
          headers: { ...sbHeaders, Prefer: "return=minimal" },
          body: JSON.stringify({ confirmed_at: new Date().toISOString() }),
        });
      } catch {
        /* mostra a página mesmo assim */
      }
    }
    return htmlPage(res, 200, resultPageHtml(lang));
  }

  if (req.method !== "POST") return json(res, 405, { ok: false });
  if (!SERVICE_ROLE) return json(res, 500, { ok: false });

  const b = parseBody(req);
  const email = String(b.email || "").trim().toLowerCase();
  const lang = String(b.lang || "").slice(0, 5) || null;
  const langKey = lang === "en" ? "en" : "pt";
  const token = b.ts || b.turnstileToken;

  const emailOk = email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  if (!emailOk) return json(res, 400, { ok: false, error: "invalid_email" });

  const ip = (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() || null;
  if (!(await verifyTurnstile(token, ip))) return json(res, 403, { ok: false, error: "captcha" });

  const confirmToken = genToken();
  try {
    // Upsert por email (merge-duplicates): grava/atualiza com novo token, PRESERVANDO confirmed_at
    // (não vai no corpo). return=representation devolve a linha p/ sabermos se já estava confirmada.
    const r = await fetch(`${SUPABASE_URL}/rest/v1/investor_waitlist`, {
      method: "POST",
      headers: { ...sbHeaders, Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ email, lang, confirm_token: confirmToken }),
    });
    if (!r.ok && r.status !== 409) {
      console.warn("waitlist upsert failed:", r.status);
      return json(res, 502, { ok: false, error: "store" });
    }
    let row = null;
    try {
      const rows = await r.json();
      row = Array.isArray(rows) ? rows[0] : null;
    } catch {
      /* return=minimal/erro de parse — segue como pendente */
    }
    const alreadyConfirmed = !!(row && row.confirmed_at);
    if (!alreadyConfirmed) {
      const url = `${SITE}/api/waitlist?confirm=${confirmToken}&lang=${langKey}`;
      await sendEmail(
        email,
        langKey === "en" ? "Confirm your spot — Pro Investor" : "Confirme sua vaga — Pro Investidor",
        confirmEmailHtml(url, langKey),
      );
    }
    return json(res, 200, { ok: true, confirmed: alreadyConfirmed });
  } catch (e) {
    console.warn("waitlist error:", e && e.name);
    return json(res, 502, { ok: false, error: "store" });
  }
}
