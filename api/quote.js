/**
 * Proxy de cotação de ativos (brapi). O token do dono vive como variável de ambiente
 * do SERVIDOR (BRAPI_TOKEN na Vercel) — nunca vai pro bundle do front nem é configurado
 * pelo usuário. O app chama /api/quote?tickers=BBAS3,PETR4 e recebe só preço/moeda.
 *
 * UMA chamada por request com TODOS os tickers (o tier free aceita lote; o limite é de
 * REQUESTS/dia, não de tickers). É barato e poupa a cota: o cache na edge (5 min) é
 * compartilhado entre todos os usuários, então no máximo ~1 chamada à brapi a cada 5 min.
 *
 * ATENÇÃO: cada ticker é codificado individualmente, mas as VÍRGULAS ficam literais —
 * encodeURIComponent na string inteira viraria %2C e a brapi leria "A,B" como UM ticker
 * inválido (devolvendo vazio). Foi esse o bug do multi-ticker.
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

  // Vírgulas LITERAIS entre tickers (só cada ticker é codificado).
  const path = tickers.map((t) => encodeURIComponent(t)).join(",");

  try {
    const url = `https://brapi.dev/api/quote/${path}?token=${encodeURIComponent(token)}`;
    const r = await fetch(url);
    if (!r.ok) {
      res.status(200).json({ results: [] });
      return;
    }
    const data = await r.json();
    const results = Array.isArray(data?.results)
      ? data.results
          .filter((x) => x && typeof x.regularMarketPrice === "number")
          .map((x) => ({
            symbol: x.symbol,
            regularMarketPrice: x.regularMarketPrice,
            currency: x.currency ?? "BRL",
          }))
      : [];
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
