/**
 * PTAX/BCB — cotação de FECHAMENTO de uma moeda numa data, pro Organizador de IRPF.
 * `/api/ptax?currency=USD&date=2024-03-15`. Público (não é dado de usuário; roda no servidor, então o
 * browser não fala com o BCB → sem mudança de CSP). Trata dia não-útil pegando a última cotação da
 * janela (≤ a data). Devolve compra E venda — o critério (compra×venda) e o método de valoração
 * ficam com o contador; o app só busca a taxa oficial.
 */
const OLINDA = "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata";

/** Date (UTC) → "MM-DD-YYYY" (formato que o Olinda espera). */
function fmtUS(d) {
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${mm}-${dd}-${d.getUTCFullYear()}`;
}

export default async function handler(req, res) {
  const currency = String(req.query.currency || "").toUpperCase();
  const date = String(req.query.date || ""); // AAAA-MM-DD
  // Cotação passada é estável → cache longo no edge.
  res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "bad-date" });
  if (currency === "BRL") return res.status(200).json({ currency, date, compra: 1, venda: 1, source: "BRL" });

  const target = new Date(date + "T00:00:00Z");
  if (Number.isNaN(target.getTime())) return res.status(400).json({ error: "bad-date" });
  const start = new Date(target.getTime() - 12 * 86400000); // janela de 12 dias (cobre feriados/fim de semana)
  const di = fmtUS(start), df = fmtUS(target);
  const opts = `&$filter=${encodeURIComponent("tipoBoletim eq 'Fechamento'")}&$orderby=${encodeURIComponent("dataHoraCotacao desc")}&$top=1&$format=json`;

  // CotacaoMoedaPeriodo atende USD/EUR/GBP (a cotação é BRL por unidade da moeda).
  const url = `${OLINDA}/CotacaoMoedaPeriodo(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@moeda='${encodeURIComponent(currency)}'&@dataInicial='${di}'&@dataFinalCotacao='${df}'${opts}`;

  try {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) return res.status(502).json({ error: "bcb-down" });
    const j = await r.json();
    const row = Array.isArray(j.value) && j.value[0] ? j.value[0] : null;
    if (!row) return res.status(404).json({ error: "no-rate" }); // data anterior à série da moeda, etc.
    return res.status(200).json({
      currency,
      requested: date,
      date: String(row.dataHoraCotacao || "").slice(0, 10),
      compra: Number(row.cotacaoCompra),
      venda: Number(row.cotacaoVenda),
      source: "PTAX/BCB",
    });
  } catch {
    return res.status(502).json({ error: "bcb-error" });
  }
}
