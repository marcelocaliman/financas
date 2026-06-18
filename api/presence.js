/**
 * Heartbeat de "online agora" — robusto (igual o /api/track). Recebe a presença de
 * uma sessão (app logado OU visitante da landing) e faz upsert anônimo em
 * public.presence via service_role. Sem cookie, sem PII: só um id de sessão aleatório
 * + a superfície. Best-effort: qualquer erro vira no-op (204).
 */
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://rudpurnhqoffwjaackka.supabase.co";

const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SURFACES = new Set(["app", "landing"]);

function clip(v, n) {
  return typeof v === "string" ? v.slice(0, n) : null;
}

export default async function handler(req, res) {
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

    const surface = clip(body.s, 12);
    const id = clip(body.id, 64);
    const bye = body.bye === 1 || body.bye === true || body.bye === "1";
    if (!surface || !SURFACES.has(surface) || !id || !SERVICE_ROLE) {
      res.status(204).end();
      return;
    }

    const auth = {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
    };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    try {
      if (bye) {
        // Saída explícita (pagehide): remove a sessão JÁ — não espera a janela de 70s expirar.
        await fetch(`${SUPABASE_URL}/rest/v1/presence?session_id=eq.${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: { ...auth, Prefer: "return=minimal" },
          signal: ctrl.signal,
        });
      } else {
        // upsert pela PK (session_id): atualiza surface + last_seen.
        await fetch(`${SUPABASE_URL}/rest/v1/presence`, {
          method: "POST",
          headers: { ...auth, Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({ session_id: id, surface, last_seen: new Date().toISOString() }),
          signal: ctrl.signal,
        });
        // Limpeza oportunista (~8% dos pings): poda sessões mortas (ex.: fechamento "duro" sem
        // beacon). Mantém a tabela enxuta sem um cron; barata graças ao índice em last_seen.
        if (Math.random() < 0.08) {
          const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
          await fetch(`${SUPABASE_URL}/rest/v1/presence?last_seen=lt.${encodeURIComponent(cutoff)}`, {
            method: "DELETE",
            headers: { ...auth, Prefer: "return=minimal" },
            signal: ctrl.signal,
          }).catch(() => {});
        }
      }
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // best-effort
  }
  res.status(204).end();
}
