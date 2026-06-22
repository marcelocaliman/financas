/**
 * Proxy de cotação de ativos (brapi). O token do dono vive como variável de ambiente
 * do SERVIDOR (BRAPI_TOKEN na Vercel) — nunca vai pro bundle do front nem é configurado
 * pelo usuário. O app chama /api/quote?tickers=BBAS3,PETR4 e recebe só preço/moeda.
 *
 * EXCLUSIVO DO SUPER-ADMIN (dono): a cotação automática é uso PESSOAL do tier free da
 * brapi. Os demais usuários ficam manuais — o produto NÃO serve cotação a usuário final
 * (o free da brapi não licencia uso comercial/redistribuição). O endpoint valida o JWT e
 * checa a tabela `admins`; quem não for admin recebe vazio. Sem cache compartilhado na
 * edge (resposta é por-usuário). Para abrir a todos no futuro: provedor pago com licença.
 *
 * UMA REQUISIÇÃO POR TICKER, em paralelo, e mescla os resultados. O tier FREE da brapi
 * devolve VAZIO para o endpoint multi-ticker (quote/A,B,C) — só o single-ticker funciona.
 */
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://rudpurnhqoffwjaackka.supabase.co";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function sbFetch(path, opts = {}, ms = 4000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(`${SUPABASE_URL}${path}`, {
      ...opts,
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        "Content-Type": "application/json",
        ...(opts.headers || {}),
      },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Caller é o super-admin? Valida o JWT do usuário e checa a tabela `admins` (= /api/ticket). */
async function isAdminRequest(req) {
  // LOG TEMPORÁRIO DE DIAGNÓSTICO (remover depois): só rótulos da decisão, sem segredos.
  if (!SUPABASE_URL || !SERVICE_ROLE) { console.log("[quote-gate] env-missing", { url: !!SUPABASE_URL, svc: !!SERVICE_ROLE }); return false; }
  const h = req.headers.authorization || req.headers.Authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m) { console.log("[quote-gate] no-jwt"); return false; }
  try {
    const ur = await sbFetch(`/auth/v1/user`, { headers: { Authorization: `Bearer ${m[1]}` } });
    if (!ur.ok) { console.log("[quote-gate] jwt-invalid", ur.status); return false; }
    const u = await ur.json();
    if (!u || !u.id) { console.log("[quote-gate] no-user-id"); return false; }
    const ar = await sbFetch(`/rest/v1/admins?user_id=eq.${encodeURIComponent(u.id)}&select=user_id`);
    if (!ar.ok) { console.log("[quote-gate] admins-query-failed", ar.status); return false; }
    const rows = await ar.json();
    const ok = Array.isArray(rows) && rows.length > 0;
    console.log("[quote-gate]", ok ? "admin-ok" : "not-in-admins");
    return ok;
  } catch (e) {
    console.log("[quote-gate] error", String(e && e.message ? e.message : e));
    return false;
  }
}

export default async function handler(req, res) {
  // Cotação automática é só do super-admin (uso pessoal do free brapi). Outros → vazio (manual).
  if (!(await isAdminRequest(req))) {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ results: [] });
    return;
  }
  const raw = String((req.query && req.query.tickers) || "").trim();
  if (!raw) {
    res.status(400).json({ results: [] });
    return;
  }
  const token = process.env.BRAPI_TOKEN;
  if (!token) {
    res.status(200).json({ results: [] });
    return;
  }

  const tickers = [
    ...new Set(
      raw
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean),
    ),
  ].slice(0, 40);
  if (tickers.length === 0) {
    res.status(400).json({ results: [] });
    return;
  }

  // Uma chamada single-ticker por símbolo (o único formato que o tier free atende), em paralelo.
  const fetchOne = async (t) => {
    try {
      const url = `https://brapi.dev/api/quote/${encodeURIComponent(t)}?token=${encodeURIComponent(token)}`;
      const r = await fetch(url);
      if (!r.ok) return null;
      const data = await r.json();
      const x = Array.isArray(data?.results) ? data.results[0] : null;
      if (x && typeof x.regularMarketPrice === "number") {
        return { symbol: x.symbol ?? t, regularMarketPrice: x.regularMarketPrice, currency: x.currency ?? "BRL" };
      }
      return null;
    } catch {
      return null;
    }
  };

  try {
    const settled = await Promise.all(tickers.map(fetchOne));
    const results = settled.filter(Boolean);
    // Sem cache compartilhado na edge: a resposta é por-usuário (só admin) e não pode ser
    // servida do CDN a outro usuário pela mesma URL. O store do cliente já faz cache + agenda
    // (≤4×/dia em dia útil), e o volume é mínimo (só o dono).
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ results });
  } catch {
    res.status(200).json({ results: [] });
  }
}
