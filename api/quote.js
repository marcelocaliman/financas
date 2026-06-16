/**
 * Proxy de cotação de ativos (brapi). O token do dono vive como variável de ambiente
 * do SERVIDOR (BRAPI_TOKEN na Vercel) — nunca vai pro bundle do front nem é configurado
 * pelo usuário. O app chama /api/quote?tickers=BBAS3,PETR4 e recebe só preço/moeda.
 * Cacheado na edge (5 min) — compartilhado entre todos os usuários, poupa a cota brapi.
 */
export default async function handler(req, res) {
  const tickers = String((req.query && req.query.tickers) || "").trim();
  if (!tickers) {
    res.status(400).json({ results: [] });
    return;
  }
  const token = process.env.BRAPI_TOKEN;
  if (!token) {
    // Sem token configurado no servidor → silencioso (app cai no custo/manual).
    res.status(200).json({ results: [] });
    return;
  }
  try {
    const url = `https://brapi.dev/api/quote/${encodeURIComponent(tickers)}?token=${encodeURIComponent(token)}`;
    const r = await fetch(url);
    if (!r.ok) {
      res.status(200).json({ results: [] });
      return;
    }
    const data = await r.json();
    const results = Array.isArray(data?.results)
      ? data.results.map((x) => ({
          symbol: x?.symbol,
          regularMarketPrice: x?.regularMarketPrice,
          currency: x?.currency,
        }))
      : [];
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.status(200).json({ results });
  } catch {
    res.status(200).json({ results: [] });
  }
}
