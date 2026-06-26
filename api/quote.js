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

async function userIdFromJwt(req) {
  if (!SUPABASE_URL || !SERVICE_ROLE) return null;
  const h = req.headers.authorization || req.headers.Authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m) return null;
  try {
    const ur = await sbFetch(`/auth/v1/user`, { headers: { Authorization: `Bearer ${m[1]}` } });
    if (!ur.ok) return null;
    const u = await ur.json();
    return u && u.id ? u.id : null;
  } catch {
    return null;
  }
}

/** Pode receber cotação ao vivo? admin SEMPRE (brapi free); assinante do Pro Investidor só
 *  com a flag 'quotes_live' ON. Espelha public.can_live_quotes() via service_role. */
async function canLiveQuotes(req) {
  const userId = await userIdFromJwt(req);
  if (!userId) return false;
  try {
    const ar = await sbFetch(`/rest/v1/admins?user_id=eq.${encodeURIComponent(userId)}&select=user_id`);
    if (ar.ok) {
      const rows = await ar.json();
      if (Array.isArray(rows) && rows.length > 0) return true; // admin sempre
    }
  } catch {
    /* segue pra checagem de assinante */
  }
  try {
    const fr = await sbFetch(`/rest/v1/app_flags?key=eq.quotes_live&select=enabled`);
    if (!fr.ok) return false;
    const f = await fr.json();
    if (!(Array.isArray(f) && f[0] && f[0].enabled === true)) return false; // flag OFF → nada além do admin
  } catch {
    return false;
  }
  try {
    const pr = await sbFetch(`/rest/v1/pro_subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=plan,status,trial_ends_at,current_period_end,cancel_at_period_end`);
    if (!pr.ok) return false;
    const s = (await pr.json())[0];
    if (!s || !["investor_monthly", "investor_annual"].includes(s.plan)) return false;
    const now = Date.now();
    if (s.status === "active" || s.status === "trialing") return true;
    if (s.trial_ends_at && new Date(s.trial_ends_at).getTime() > now) return true;
    if (s.status === "canceled" && s.cancel_at_period_end && s.current_period_end && new Date(s.current_period_end).getTime() > now) return true;
    return false;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  // Gate: admin sempre (brapi free, uso pessoal); assinante do Pro Investidor só com a flag
  // 'quotes_live' ON (super-admin liga depois de assinar o brapi pago). Outros → vazio (manual).
  if (!(await canLiveQuotes(req))) {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ results: [] });
    return;
  }
  const raw = String((req.query && req.query.tickers) || "").trim();
  if (!raw) {
    res.status(400).json({ results: [] });
    return;
  }
  const brapiToken = process.env.BRAPI_TOKEN;
  const finnhubKey = process.env.FINNHUB_API_KEY;
  if (!brapiToken && !finnhubKey) {
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

  // Roteamento: tickers da B3 terminam em dígito (PETR4, HGLG11) → brapi; o resto (AAPL, MSFT) → Finnhub.
  const isB3 = (t) => /\d$/.test(t);

  // brapi: uma chamada single-ticker (único formato do tier free).
  const fetchBrapi = async (t) => {
    if (!brapiToken) return null;
    try {
      const r = await fetch(`https://brapi.dev/api/quote/${encodeURIComponent(t)}?token=${encodeURIComponent(brapiToken)}`);
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

  // Finnhub (internacional): /quote traz o preço (c). A moeda vem do /stock/profile2 como
  // BEST-EFFORT — se falhar (rate limit/símbolo sem perfil), assume USD e a cotação segue
  // (igual ao brapi: uma chamada crítica + uma opcional que nunca derruba o preço).
  const fetchFinnhub = async (t) => {
    if (!finnhubKey) return null;
    try {
      const qr = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(t)}&token=${encodeURIComponent(finnhubKey)}`);
      if (!qr.ok) return null;
      const d = await qr.json();
      if (!(d && typeof d.c === "number" && d.c > 0)) return null;
      let currency = "USD";
      try {
        const pr = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(t)}&token=${encodeURIComponent(finnhubKey)}`);
        if (pr.ok) {
          const p = await pr.json();
          if (p && p.currency) currency = String(p.currency).toUpperCase();
        }
      } catch {
        /* profile opcional — mantém USD */
      }
      return { symbol: t, regularMarketPrice: d.c, currency };
    } catch {
      return null;
    }
  };

  try {
    const settled = await Promise.all(tickers.map((t) => (isB3(t) ? fetchBrapi(t) : fetchFinnhub(t))));
    const results = settled.filter(Boolean);
    // Resposta por-usuário (gate), sem cache compartilhado na edge. O store do cliente já agenda.
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ results });
  } catch {
    res.status(200).json({ results: [] });
  }
}
