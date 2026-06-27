/**
 * Proxy de cotação de ativos. Os tokens do dono (BRAPI_TOKEN / FINNHUB_API_KEY) vivem como
 * variáveis de ambiente do SERVIDOR — nunca vão pro bundle nem são configurados pelo usuário.
 * O app chama /api/quote?tickers=PETR4,AAPL e recebe só preço/moeda.
 *
 * GATE (can_live_quotes): super-admin SEMPRE (uso pessoal do tier free); assinante do Pro
 * Investidor só com a flag 'quotes_live' ON (provedor PAGO). Quem não passa recebe vazio (manual).
 *
 * CACHE COMPARTILHADO (quote_cache, por símbolo): todos os usuários dividem UMA busca upstream
 * por símbolo por janela — o custo escala com "símbolos distintos", não com "usuários". O
 * `updated_at` do cache é também a TRAVA DE CADÊNCIA no servidor (CACHE_TTL_MS): por mais que o
 * cliente peça, a brapi/Finnhub só é consultada quando o valor cacheado vence. E2EE intacto: o
 * cache guarda só símbolo→preço (dado público de mercado), nunca quem possui o quê.
 *
 * Roteamento: ticker B3 termina em dígito (PETR4) → brapi single-ticker (único formato do tier
 * free); o resto (AAPL) → Finnhub. Uma requisição por ticker VENCIDO, em paralelo.
 */
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://rudpurnhqoffwjaackka.supabase.co";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Janela do cache compartilhado = trava de cadência no servidor. ~55 min: um pouco abaixo da
// cadência horária do cliente, então a atualização agendada pega valor fresco, mas qualquer
// chamada extra/concorrente dentro da janela é servida do cache (1 busca upstream/símbolo/hora,
// dividida entre TODOS os usuários — admin 4×/dia já fica bem abaixo disso).
const CACHE_TTL_MS = 55 * 60 * 1000;

// Cache NEGATIVO: quando a fonte volta vazia/erro pra um símbolo, marca a tentativa por ~10 min
// (preço sentinela ≤ 0). Enquanto vale, o servidor NÃO re-bate no upstream desse símbolo — blinda
// o custo mesmo se o cliente re-disparar a cada alt-tab/evento online. Passada a janela, re-tenta.
const NEG_TTL_MS = 10 * 60 * 1000;

// Single-flight: janela de dedup do claim atômico. Concorrentes que pedem o mesmo símbolo vencido
// dentro desses segundos NÃO re-buscam (um ganha a linha, os outros servem o cache). Só precisa
// cobrir a duração de uma busca upstream; depois dela o símbolo volta a parecer fresco/negativo.
const CLAIM_DEDUP_SECONDS = 30;

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
        // Só símbolos válidos (letras/dígitos/ponto) — descarta lixo e protege o filtro in() do cache.
        .filter((t) => /^[A-Z0-9.]{1,12}$/.test(t)),
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
  // (igual ao brapi: uma chamada crítica + uma opcional que nunca derruba o preço). A moeda é
  // praticamente IMUTÁVEL: se já a conhecemos (do cache), reusa e PULA o profile2 — corta ~metade
  // das chamadas Finnhub por ticker intl (só resolve no 1º encontro do símbolo).
  const fetchFinnhub = async (t, knownCurrency) => {
    if (!finnhubKey) return null;
    try {
      const qr = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(t)}&token=${encodeURIComponent(finnhubKey)}`);
      if (!qr.ok) return null;
      const d = await qr.json();
      if (!(d && typeof d.c === "number" && d.c > 0)) return null;
      const known = knownCurrency && knownCurrency.length >= 3;
      let currency = known ? knownCurrency : "USD";
      if (!known) {
        try {
          const pr = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(t)}&token=${encodeURIComponent(finnhubKey)}`);
          if (pr.ok) {
            const p = await pr.json();
            if (p && p.currency) currency = String(p.currency).toUpperCase();
          }
        } catch {
          /* profile opcional — mantém USD */
        }
      }
      return { symbol: t, regularMarketPrice: d.c, currency };
    } catch {
      return null;
    }
  };

  const now = Date.now();

  // 1. Cache COMPARTILHADO: lê numa query só os símbolos pedidos. Quem está fresco (< TTL) é
  //    servido daqui — todos os usuários dividem a MESMA busca upstream (custo por símbolo, não
  //    por usuário). Falha de leitura → trata tudo como vencido e busca upstream.
  const cached = Object.create(null);
  try {
    const cr = await sbFetch(`/rest/v1/quote_cache?symbol=in.(${tickers.join(",")})&select=symbol,price,currency,updated_at`);
    if (cr.ok) {
      for (const r of await cr.json()) {
        cached[r.symbol] = { price: Number(r.price), currency: r.currency, age: now - new Date(r.updated_at).getTime() };
      }
    }
  } catch {
    /* sem cache → busca tudo */
  }

  // 2. Separa: FRESCO (serve do cache) · NEGATIVO recente (fonte sem preço agora → não re-bate,
  //    não serve; cliente mantém o último valor local) · VENCIDO/ausente (busca upstream).
  const fresh = [];
  const stale = [];
  for (const t of tickers) {
    const c = cached[t];
    if (c && typeof c.price === "number" && c.price > 0 && c.age < CACHE_TTL_MS) {
      fresh.push({ symbol: t, regularMarketPrice: c.price, currency: c.currency });
    } else if (c && !(c.price > 0) && c.age < NEG_TTL_MS) {
      /* marca negativa recente: pula (blinda o upstream) */
    } else {
      stale.push(t);
    }
  }

  // 3. SINGLE-FLIGHT: claim ATÔMICO dos vencidos. Só quem ganha a linha busca upstream; concorrentes
  //    que pedem o mesmo símbolo no mesmo instante perdem a corrida e servem o último valor do cache
  //    (stale-while-revalidate). Degrada com segurança: se o claim falhar, busca todos (sem dedup).
  let won = stale;
  if (stale.length > 0) {
    try {
      const cl = await sbFetch(`/rest/v1/rpc/claim_quote_symbols`, {
        method: "POST",
        body: JSON.stringify({ syms: stale, dedup_seconds: CLAIM_DEDUP_SECONDS }),
      });
      if (cl.ok) {
        const rows = await cl.json();
        won = Array.isArray(rows) ? rows.map((r) => r.sym).filter(Boolean) : [];
      }
    } catch {
      /* claim indisponível → won = stale (busca todos, ainda correto) */
    }
  }

  // 4. Busca upstream SÓ os GANHOS (B3 → brapi; resto → Finnhub, reusando a moeda cacheada).
  const fetched = [];
  const failed = [];
  try {
    const settled = await Promise.all(won.map((t) => (isB3(t) ? fetchBrapi(t) : fetchFinnhub(t, cached[t]?.currency))));
    for (let i = 0; i < won.length; i++) {
      const r = settled[i];
      if (r) fetched.push({ symbol: won[i], regularMarketPrice: r.regularMarketPrice, currency: r.currency });
      else failed.push(won[i]);
    }
  } catch {
    /* fetchBrapi/fetchFinnhub já capturam seus erros; mantém o que veio */
  }

  // 5. Grava os GANHOS no cache: preços reais + marcas NEGATIVAS dos que falharam (sentinela
  //    price=-1, preservando a moeda conhecida). Quem perdeu a corrida NÃO grava (o vencedor cuida).
  const iso = new Date(now).toISOString();
  const rows = [
    ...fetched.map((x) => ({ symbol: x.symbol, price: x.regularMarketPrice, currency: x.currency, updated_at: iso })),
    ...failed.map((s) => ({ symbol: s, price: -1, currency: cached[s]?.currency || "", updated_at: iso })),
  ];
  if (rows.length > 0) {
    try {
      await sbFetch(`/rest/v1/quote_cache`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(rows),
      });
    } catch {
      /* cache é best-effort; a resposta já tem o preço */
    }
  }

  // 6. Resposta = frescos + ganhos buscados + (perdeu a corrida OU falhou) servindo o último valor
  //    bom do cache, se houver (stale-while-revalidate). Marcas negativas/sem valor não entram.
  const fetchedBySym = Object.create(null);
  for (const x of fetched) fetchedBySym[x.symbol] = x;
  const results = [...fresh];
  for (const t of stale) {
    const f = fetchedBySym[t];
    if (f) {
      results.push({ symbol: t, regularMarketPrice: f.regularMarketPrice, currency: f.currency });
    } else {
      const c = cached[t];
      if (c && c.price > 0) results.push({ symbol: t, regularMarketPrice: c.price, currency: c.currency });
    }
  }
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ results });
}
