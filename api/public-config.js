/**
 * Config PÚBLICA (sem auth) que a landing pode ler — hoje só a flag `quotes_live`
 * (liga o card do Pro Investidor na landing). Não expõe nada sensível: é um booleano
 * de feature-flag. Lê via service_role (app_flags tem RLS) e cacheia 60s na edge.
 */
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://rudpurnhqoffwjaackka.supabase.co";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  let quotesLive = false;
  if (SERVICE_ROLE) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_flags?key=eq.quotes_live&select=enabled`, {
        headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
      });
      if (r.ok) {
        const d = await r.json();
        quotesLive = !!(Array.isArray(d) && d[0] && d[0].enabled === true);
      }
    } catch {
      /* default false */
    }
  }
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");
  res.status(200).json({ quotesLive });
}
