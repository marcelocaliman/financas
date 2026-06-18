/**
 * Coletor de analytics PRÓPRIO (privacy-first). Recebe um evento NÃO-sensível do
 * front (landing ou app) e o grava em public.app_events via service_role — a única
 * via de escrita na tabela (RLS bloqueia anon/authenticated). Sem cookie, sem PII,
 * sem dado financeiro: só nome de evento + anon_id pseudônimo + caminho/idioma.
 *
 * Tudo é best-effort: qualquer falta de config ou erro vira no-op silencioso (204)
 * — analytics jamais pode quebrar a landing nem o app.
 *
 * Variáveis de ambiente (Vercel): SUPABASE_SERVICE_ROLE_KEY (obrigatória p/ gravar)
 * e SUPABASE_URL (cai no projeto conhecido se ausente).
 */
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://gozliwxplajjlpzkjkmv.supabase.co";

const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Allowlist — só estes eventos são aceitos (evita lixo/abuso na tabela).
const ALLOWED = new Set(["landing_view", "cta_click", "signup", "login", "app_open", "section_view"]);
const SURFACES = new Set(["landing", "app"]);

function clip(v, n) {
  return typeof v === "string" ? v.slice(0, n) : null;
}

export default async function handler(req, res) {
  // Beacon/fetch são sempre POST; respondemos 204 pra qualquer outra coisa.
  if (req.method !== "POST") {
    res.status(204).end();
    return;
  }
  try {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    body = body || {};

    const name = clip(body.n, 40);
    const surface = clip(body.s, 12);
    if (!name || !ALLOWED.has(name) || !surface || !SURFACES.has(surface) || !SERVICE_ROLE) {
      res.status(204).end();
      return;
    }

    // props: só um punhado de chaves curtas de UI (nunca financeiro). Saneadas.
    let props = {};
    if (body.p && typeof body.p === "object" && !Array.isArray(body.p)) {
      for (const k of Object.keys(body.p).slice(0, 8)) {
        const val = body.p[k];
        if (typeof val === "string") props[clip(k, 24)] = clip(val, 64);
        else if (typeof val === "number" || typeof val === "boolean") props[clip(k, 24)] = val;
      }
    }

    const row = {
      surface,
      name,
      anon_id: clip(body.a, 40),
      path: clip(body.path, 120),
      lang: clip(body.l, 8),
      props,
    };

    // timeout curto: se o PostgREST pendurar, não seguramos a function até o limite da Vercel.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/app_events`, {
        method: "POST",
        headers: {
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(row),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // engole tudo — best-effort
  }
  res.status(204).end();
}
