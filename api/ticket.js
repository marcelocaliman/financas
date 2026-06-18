/**
 * /api/ticket — central de tickets de suporte (criar / consultar / responder).
 *
 * Suporte é correspondência em TEXTO CLARO (não é o cofre E2EE): o dono precisa ler
 * pra responder. Escrita só aqui (service_role) — a tabela bloqueia anon/authenticated.
 *
 * Ações (via ?action=):
 *   create  POST  — abre um ticket.
 *                   • Registrado: header Authorization: Bearer <jwt> → user_id/email do auth.
 *                   • Convidado (landing): body.email + captcha (Turnstile) → gera access_token.
 *   get     GET   — ?t=<token>: thread do convidado pelo token (sem conta).
 *   reply   POST  — adiciona mensagem.
 *                   • Convidado: ?t=<token>.
 *                   • Registrado/dono: Authorization: Bearer <jwt> (dono → resposta de admin).
 *
 * Notifica por e-mail (Resend): o DONO em todo ticket/resposta do usuário; o USUÁRIO/convidado
 * quando o dono responde. Tudo best-effort — e-mail nunca derruba a operação.
 *
 * Env (Vercel): SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, RESEND_API_KEY, EMAIL_FROM,
 *   CRON_ALERT_EMAIL (destino do alerta pro dono), TURNSTILE_SECRET_KEY.
 */

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://rudpurnhqoffwjaackka.supabase.co";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || "Nossas Finanças <nao-responda@nossasfinancas.com.br>";
const OWNER_EMAIL = process.env.CRON_ALERT_EMAIL || "marcelo.salgado.caliman@gmail.com";
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY;
const SITE = "https://nossasfinancas.com.br";

const CATEGORIES = new Set(["duvida", "problema", "sugestao", "conta", "outro"]);
const META_KEYS = new Set(["app_version", "section", "ua", "tz", "screen", "path", "referrer"]);

function clip(v, n) {
  return typeof v === "string" ? v.slice(0, n) : null;
}
function json(res, code, obj) {
  res.status(code).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(obj));
}
function parseBody(req) {
  let b = req.body;
  if (typeof b === "string") {
    try { b = JSON.parse(b); } catch { b = {}; }
  }
  return b || {};
}
function genToken() {
  const a = new Uint8Array(24);
  if (globalThis.crypto && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(a);
  } else {
    for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const auth = {
  apikey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
  "Content-Type": "application/json",
};

async function sbFetch(path, opts = {}, ms = 4000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(`${SUPABASE_URL}${path}`, { ...opts, headers: { ...auth, ...(opts.headers || {}) }, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Valida o JWT do usuário e devolve { id, email } ou null. */
async function userFromJwt(req) {
  const h = req.headers.authorization || req.headers.Authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m) return null;
  try {
    const r = await sbFetch(`/auth/v1/user`, { headers: { Authorization: `Bearer ${m[1]}` } }, 4000);
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? { id: u.id, email: u.email } : null;
  } catch {
    return null;
  }
}

async function isAdmin(userId) {
  try {
    const r = await sbFetch(`/rest/v1/admins?user_id=eq.${encodeURIComponent(userId)}&select=user_id`);
    if (!r.ok) return false;
    const rows = await r.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

async function verifyTurnstile(token, ip) {
  if (!TURNSTILE_SECRET) return false; // fail-secure: sem secret, bloqueia (nunca abre p/ spam)
  if (!token) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const body = new URLSearchParams({ secret: TURNSTILE_SECRET, response: token });
    if (ip) body.set("remoteip", ip);
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: ctrl.signal,
    });
    const d = await r.json();
    return d && d.success === true;
  } catch {
    return false; // timeout/erro de rede → rejeita (fail-secure)
  } finally {
    clearTimeout(timer);
  }
}

// ATENÇÃO: `heading`/`ctaLabel` são escapados aqui; `lead` é inserido como HTML CRU
// (permite <b> etc.) — todo dado do usuário dentro de `lead` PRECISA vir já passado por esc().
// `quote` é escapado internamente.
function emailShell({ heading, lead, quote, ctaUrl, ctaLabel }) {
  const cta = ctaUrl
    ? `<a href="${esc(ctaUrl)}" style="display:inline-block;background:#3ecf8e;color:#0a0b0d;font-weight:600;text-decoration:none;padding:11px 22px;border-radius:10px;font-size:14px">${esc(ctaLabel || "Abrir")}</a>`
    : "";
  const q = quote
    ? `<div style="border-left:2px solid #3ecf8e;padding:6px 0 6px 14px;margin:14px 0;color:#c9ccd2;font-size:14px;white-space:pre-wrap">${esc(quote)}</div>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#0a0b0d;padding:28px 14px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#131418;border:1px solid rgba(255,255,255,.08);border-radius:16px;overflow:hidden;font-family:Inter,Helvetica,Arial,sans-serif">
      <tr><td style="padding:24px 28px 0">
        <img src="${SITE}/apple-touch-icon.png" width="34" height="34" alt="Nossas Finanças" style="border-radius:8px;display:block">
      </td></tr>
      <tr><td style="padding:18px 28px 26px;color:#f3f4f6">
        <div style="font-size:18px;font-weight:600;letter-spacing:-.01em">${esc(heading)}</div>
        <div style="font-size:14px;color:#9ca2ac;margin-top:8px;line-height:1.55">${lead}</div>
        ${q}
        <div style="margin-top:18px">${cta}</div>
      </td></tr>
      <tr><td style="padding:14px 28px;border-top:1px solid rgba(255,255,255,.08);color:#5f646c;font-size:11px">
        Nossas Finanças · suporte. Não responda este e-mail — use o link acima.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
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
    /* best-effort */
  }
}

function notifyOwnerNew(ticket, body) {
  const html = emailShell({
    heading: `Novo ticket — ${ticket.subject}`,
    lead: `<b style="color:#f3f4f6">${esc(ticket.email)}</b> abriu um ticket (${esc(ticket.category)} · ${esc(ticket.surface)}).`,
    quote: body,
    ctaUrl: `${SITE}/app`,
    ctaLabel: "Responder no painel",
  });
  return sendEmail(OWNER_EMAIL, `Novo ticket: ${ticket.subject}`, html);
}
function notifyOwnerReply(ticket, body) {
  const html = emailShell({
    heading: `Nova resposta — ${ticket.subject}`,
    lead: `<b style="color:#f3f4f6">${esc(ticket.email)}</b> respondeu no ticket.`,
    quote: body,
    ctaUrl: `${SITE}/app`,
    ctaLabel: "Ver no painel",
  });
  return sendEmail(OWNER_EMAIL, `Resposta: ${ticket.subject}`, html);
}
function notifyUserReply(ticket, body) {
  const url = ticket.user_id ? `${SITE}/app` : `${SITE}/ticket?t=${ticket.access_token}`;
  const html = emailShell({
    heading: "Você tem uma resposta",
    lead: `Respondemos o seu ticket <b style="color:#f3f4f6">"${esc(ticket.subject)}"</b>.`,
    quote: body,
    ctaUrl: url,
    ctaLabel: "Ver a resposta",
  });
  return sendEmail(ticket.email, `Re: ${ticket.subject}`, html);
}

function sanitizeMeta(meta) {
  const out = {};
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    for (const k of Object.keys(meta)) {
      if (META_KEYS.has(k)) {
        const v = meta[k];
        if (typeof v === "string") out[k] = v.slice(0, 160);
        else if (typeof v === "number" || typeof v === "boolean") out[k] = v;
      }
    }
  }
  return out;
}

async function insertMessage(ticketId, author, body) {
  await sbFetch(`/rest/v1/ticket_messages`, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ ticket_id: ticketId, author, body }),
  });
}
async function touchTicket(ticketId, patch) {
  await sbFetch(`/rest/v1/tickets?id=eq.${ticketId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ ...patch, last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
  });
}

// ── Ações ────────────────────────────────────────────────────────────────────

async function handleCreate(req, res) {
  const body = parseBody(req);
  const subject = clip(body.subject, 200);
  const message = clip(body.body, 5000);
  let category = clip(body.category, 20);
  if (!CATEGORIES.has(category)) category = "duvida";
  const locale = clip(body.locale, 8);
  const meta = sanitizeMeta(body.meta);

  if (!subject || !subject.trim() || !message || !message.trim()) {
    return json(res, 400, { error: "missing_fields" });
  }

  const user = await userFromJwt(req);
  let row;
  if (user) {
    // Registrado
    row = {
      user_id: user.id, email: user.email, name: clip(body.name, 80),
      subject, category, surface: "app", locale, meta, last_author: "user",
    };
  } else {
    // Convidado (landing): precisa de e-mail + captcha
    const email = clip(body.email, 200);
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(res, 400, { error: "invalid_email" });
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim();
    if (!(await verifyTurnstile(body.captcha, ip))) return json(res, 403, { error: "captcha_failed" });
    row = {
      user_id: null, email, name: clip(body.name, 80),
      subject, category, surface: "landing", locale, meta, last_author: "user",
      access_token: genToken(),
    };
  }

  const r = await sbFetch(`/rest/v1/tickets`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (!r.ok) return json(res, 502, { error: "create_failed" });
  const created = (await r.json())[0];
  if (!created || !created.id) return json(res, 502, { error: "create_failed" });
  await insertMessage(created.id, "user", message);

  void notifyOwnerNew(created, message);
  if (!user) void notifyUserConfirmation(created);

  return json(res, 201, user ? { id: created.id } : { id: created.id, token: created.access_token });
}

function notifyUserConfirmation(ticket) {
  const html = emailShell({
    heading: "Recebemos o seu contato",
    lead: `Obrigado! Vamos responder por aqui. Acompanhe e responda pelo link abaixo (guarde-o — é o seu acesso ao ticket).`,
    quote: ticket.subject,
    ctaUrl: `${SITE}/ticket?t=${ticket.access_token}`,
    ctaLabel: "Acompanhar o ticket",
  });
  return sendEmail(ticket.email, `Ticket recebido: ${ticket.subject}`, html);
}

async function handleGet(req, res) {
  const token = clip((req.query && req.query.t) || "", 80);
  if (!token) return json(res, 400, { error: "missing_token" });
  const r = await sbFetch(`/rest/v1/tickets?access_token=eq.${encodeURIComponent(token)}&select=id,email,name,subject,category,status,surface,last_author,created_at,last_message_at`);
  if (!r.ok) return json(res, 502, { error: "fetch_failed" });
  const rows = await r.json();
  if (!Array.isArray(rows) || rows.length === 0) return json(res, 404, { error: "not_found" });
  const ticket = rows[0];
  const mr = await sbFetch(`/rest/v1/ticket_messages?ticket_id=eq.${ticket.id}&select=id,author,body,created_at&order=created_at.asc`);
  const messages = mr.ok ? await mr.json() : [];
  return json(res, 200, { ticket, messages });
}

async function handleReply(req, res) {
  const body = parseBody(req);
  const message = clip(body.body, 5000);
  if (!message || !message.trim()) return json(res, 400, { error: "missing_body" });

  const token = clip((req.query && req.query.t) || "", 80);
  let ticket = null;
  let author = "user";

  if (token) {
    // Convidado pelo token
    const r = await sbFetch(`/rest/v1/tickets?access_token=eq.${encodeURIComponent(token)}&select=*`);
    const rows = r.ok ? await r.json() : [];
    ticket = rows[0];
    if (!ticket) return json(res, 404, { error: "not_found" });
    author = "user";
  } else {
    // Registrado/dono pelo JWT
    const user = await userFromJwt(req);
    if (!user) return json(res, 401, { error: "unauthenticated" });
    const tid = clip(body.ticket_id, 60);
    if (!tid) return json(res, 400, { error: "missing_ticket_id" });
    const r = await sbFetch(`/rest/v1/tickets?id=eq.${encodeURIComponent(tid)}&select=*`);
    const rows = r.ok ? await r.json() : [];
    ticket = rows[0];
    if (!ticket) return json(res, 404, { error: "not_found" });
    const owner = ticket.user_id && ticket.user_id === user.id;
    const admin = await isAdmin(user.id);
    if (!owner && !admin) return json(res, 403, { error: "forbidden" });
    author = owner ? "user" : "admin";
  }

  await insertMessage(ticket.id, author, message);
  await touchTicket(ticket.id, author === "user" ? { last_author: "user", status: "open" } : { last_author: "admin" });

  if (author === "user") void notifyOwnerReply(ticket, message);
  else void notifyUserReply(ticket, message);

  return json(res, 201, { ok: true });
}

export default async function handler(req, res) {
  if (!SERVICE_ROLE) return json(res, 500, { error: "not_configured" });
  const action = (req.query && req.query.action) || "";
  try {
    if (action === "create" && req.method === "POST") return await handleCreate(req, res);
    if (action === "get" && req.method === "GET") return await handleGet(req, res);
    if (action === "reply" && req.method === "POST") return await handleReply(req, res);
    return json(res, 400, { error: "bad_action" });
  } catch (e) {
    return json(res, 500, { error: "server_error" });
  }
}
