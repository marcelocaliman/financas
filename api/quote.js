/**
 * Proxy de cotação de ativos (brapi). O token do dono vive como variável de ambiente
 * do SERVIDOR (BRAPI_TOKEN na Vercel) — nunca vai pro bundle do front nem é configurado
 * pelo usuário. O app chama /api/quote?tickers=BBAS3,PETR4 e recebe só preço/moeda.
 *
 * UMA REQUISIÇÃO POR TICKER, em paralelo, e mescla os resultados. O tier FREE da brapi
 * devolve VAZIO para o endpoint multi-ticker (quote/A,B,C) — só o single-ticker funciona;
 * por isso quebrávamos as cotações de quase tudo (só sobrava o ticker que tinha sido
 * adicionado sozinho, do cache). O custo é N chamadas por cache-miss, mas o cache na edge
 * (5 min, compartilhado) segura o volume. Para escalar a muitos usuários, subir o plano.
 */
export default async function handler(req, res) {
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
    // Só cacheia SUCESSO (preços) — um vazio transitório (cota/erro) não pode ficar
    // preso na edge por minutos e mascarar a cotação. Vazio re-tenta na próxima.
    if (results.length > 0) {
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    } else {
      res.setHeader("Cache-Control", "no-store");
    }
    res.status(200).json({ results });
  } catch {
    res.status(200).json({ results: [] });
  }
}
