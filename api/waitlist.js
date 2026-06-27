/**
 * /api/waitlist — lista de espera do Pro Investidor (landing). POST { email, ts, lang }.
 *
 * Enquanto a flag quotes_live está OFF, o card mostra "Em breve" e capta o email de quem quer ser
 * avisado quando o plano ligar — sinal de DEMANDA (quantos) + lista de NOTIFICAÇÃO. Texto claro
 * (não é o cofre E2EE): lista de contato com consentimento, como email_optin/tickets. Escrita só
 * aqui via service_role (a tabela bloqueia anon/authenticated). Dedupe por email (PK).
 *
 * Anti-spam: Turnstile invisível (mesma chave do formulário de contato), fail-secure — sem segredo
 * ou sem token válido → rejeita. Env (Vercel): SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, TURNSTILE_SECRET_KEY.
 */
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://rudpurnhqoffwjaackka.supabase.co";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY;

function json(res, code, obj) {
  res.status(code).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(obj));
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

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false });
  if (!SERVICE_ROLE) return json(res, 500, { ok: false });

  const b = parseBody(req);
  const email = String(b.email || "").trim().toLowerCase();
  const lang = (String(b.lang || "").slice(0, 5) || null);
  const token = b.ts || b.turnstileToken;

  // Validação de email simples e robusta (e cap de tamanho).
  const emailOk = email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  if (!emailOk) return json(res, 400, { ok: false, error: "invalid_email" });

  const ip = (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() || null;
  if (!(await verifyTurnstile(token, ip))) return json(res, 403, { ok: false, error: "captcha" });

  // Upsert com dedupe por email (ignore-duplicates → re-enviar o mesmo email é no-op).
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/investor_waitlist`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify({ email, lang }),
    });
    // 2xx = inserido (ou no-op idempotente do ignore-duplicates); 409 = duplicado bruto. Ambos OK.
    if (r.ok || r.status === 409) return json(res, 200, { ok: true });
    // Falha REAL (5xx/RLS/schema): NÃO finge sucesso — senão o email some e o contador de demanda
    // (a razão da feature) corrompe. Loga só o STATUS (nunca corpo/segredo) e devolve erro genérico
    // pro cliente reabilitar o botão e pedir pra tentar de novo.
    console.warn("waitlist insert failed:", r.status);
    return json(res, 502, { ok: false, error: "store" });
  } catch (e) {
    console.warn("waitlist insert error:", e && e.name);
    return json(res, 502, { ok: false, error: "store" });
  }
}
