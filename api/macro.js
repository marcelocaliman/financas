/**
 * Indicadores macro por PRAÇA/MOEDA — taxa básica de juros + inflação (12m). Públicos (não é
 * dado de usuário). `/api/macro?c=BRL|EUR|USD|GBP`.
 *
 * Robustez (o card NÃO pode ficar "—"): cada métrica tem fonte oficial + fallback vivo, e há um
 * CACHE DURÁVEL de "último valor bom" no Supabase (public.macro_cache). Se a fonte cair na hora
 * (o IP do datacenter é bloqueado/limitado de vez em quando), preenchemos a lacuna com a última
 * leitura REAL já vista — nunca um número chumbado/defasado (IPCA é mensal, Selic é por Copom).
 *   BRL → Selic meta (BCB SGS 432) + IPCA 12m (BCB SGS 13522 → fallback IBGE SIDRA 2265)
 *   EUR → BCE (taxa de depósito DFR) + HICP anual (Eurostat)
 *   USD → NY Fed (EFFR) + BLS (CPI YoY)
 *   GBP → BoE (Bank Rate) + ONS (CPI 12m, best-effort)
 * Edge cache: LONGO só quando os dois vêm; CURTO quando falta algo (auto-cura, sem congelar lacuna).
 */
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://rudpurnhqoffwjaackka.supabase.co";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const toNum = (v) => {
  const n = v == null ? NaN : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const get = (url, signal, headers) => fetch(url, { signal, headers: { Accept: "application/json", ...headers } });

async function bcb(id, signal) {
  try {
    const r = await get(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${id}/dados/ultimos/1?formato=json`, signal);
    if (!r.ok) return null;
    const j = await r.json();
    return toNum(Array.isArray(j) && j[0] ? j[0].valor : null);
  } catch { return null; }
}

/** IPCA acumulado 12m direto do IBGE (SIDRA) — fonte oficial independente do BCB (fallback). */
async function ibgeIpca12m(signal) {
  try {
    const r = await get(
      "https://servicodados.ibge.gov.br/api/v3/agregados/1737/periodos/-1/variaveis/2265?localidades=N1%5Ball%5D",
      signal,
    );
    if (!r.ok) return null;
    const j = await r.json();
    const serie = j?.[0]?.resultados?.[0]?.series?.[0]?.serie;
    if (!serie) return null;
    const last = Object.keys(serie).sort().pop(); // período mais recente (AAAAMM)
    return last ? toNum(serie[last]) : null;
  } catch { return null; }
}

/** IPCA 12m: BCB primeiro; se cair, IBGE. */
async function ipca12m(signal) {
  const a = await bcb(13522, signal);
  return a != null ? a : ibgeIpca12m(signal);
}

/** Selic meta: série 432; se esse endpoint específico falhar (host de pé), tenta a 1178 (anualizada). */
async function selicBR(signal) {
  const a = await bcb(432, signal);
  return a != null ? a : bcb(1178, signal);
}

async function ecb(key, signal) {
  try {
    const r = await get(`https://data-api.ecb.europa.eu/service/data/${key}?lastNObservations=1&format=csvdata`, signal, { Accept: "text/csv" });
    if (!r.ok) return null;
    const lines = (await r.text()).trim().split("\n");
    const head = lines[0].split(",");
    const i = head.indexOf("OBS_VALUE");
    return i >= 0 && lines[1] ? toNum(lines[1].split(",")[i]) : null;
  } catch { return null; }
}

async function effr(signal) {
  try {
    const r = await get("https://markets.newyorkfed.org/api/rates/unsecured/effr/last/1.json", signal);
    if (!r.ok) return null;
    const j = await r.json();
    return toNum(j?.refRates?.[0]?.percentRate);
  } catch { return null; }
}

async function blsCpiYoY(signal) {
  try {
    const now = new Date().getUTCFullYear();
    const r = await get(`https://api.bls.gov/publicAPI/v1/timeseries/data/CUUR0000SA0?startyear=${now - 1}&endyear=${now}`, signal);
    if (!r.ok) return null;
    const j = await r.json();
    const data = (j?.Results?.series?.[0]?.data ?? []).filter((d) => /^M(0[1-9]|1[0-2])$/.test(d.period));
    data.sort((a, b) => (b.year - a.year) || b.period.localeCompare(a.period));
    const latest = data[0];
    if (!latest) return null;
    const prior = data.find((d) => Number(d.year) === Number(latest.year) - 1 && d.period === latest.period);
    if (!prior) return null;
    const cur = Number(latest.value), prev = Number(prior.value);
    return prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null;
  } catch { return null; }
}

async function boeRate(signal) {
  try {
    const url = "https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp?csv.x=yes&Datefrom=01/Jan/2024&Dateto=now&SeriesCodes=IUDBEDR&CSVF=TN&UsingCodes=Y&VPD=Y&VFD=N";
    const r = await get(url, signal, { Accept: "text/csv" });
    if (!r.ok) return null;
    const lines = (await r.text()).trim().split("\n").filter((l) => /,/.test(l));
    const last = lines[lines.length - 1];
    return last ? toNum(last.split(",").pop()) : null;
  } catch { return null; }
}

async function onsCpi(signal) {
  // A api.ons.gov.uk foi DESATIVADA (aposentada em 25/11/2024). Fonte atual = JSON do site da ONS.
  // d7g7 = CPI 12m (manchete); l55o = CPIH 12m (fallback). Lê de `months` (último) ou da descrição.
  for (const cdid of ["d7g7", "l55o"]) {
    try {
      const r = await get(`https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/${cdid}/mm23/data`, signal);
      if (!r.ok) continue;
      const j = await r.json();
      const months = j?.months ?? [];
      const v = (months.length ? toNum(months[months.length - 1].value) : null) ?? toNum(j?.description?.number);
      if (v != null) return v;
    } catch { /* tenta o próximo */ }
  }
  return null;
}

const PROVIDERS = {
  BRL: (s) => Promise.all([selicBR(s), ipca12m(s)]),
  EUR: (s) => Promise.all([ecb("FM/B.U2.EUR.4F.KR.DFR.LEV", s), ecb("ICP/M.U2.N.000000.4.ANR", s)]),
  USD: (s) => Promise.all([effr(s), blsCpiYoY(s)]),
  GBP: (s) => Promise.all([boeRate(s), onsCpi(s)]),
};

/* ── Cache durável (último valor bom) — REST do Supabase via service_role ─────────────────────── */

async function readCache(c, signal) {
  if (!SERVICE_ROLE) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/macro_cache?currency=eq.${c}&select=rate,inflation,updated_at`, {
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
      signal,
    });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) && j[0] ? j[0] : null;
  } catch { return null; }
}

async function writeCache(c, rate, inflation) {
  if (!SERVICE_ROLE) return;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2500);
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/macro_cache?on_conflict=currency`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({ currency: c, rate, inflation, updated_at: new Date().toISOString() }),
      signal: ctrl.signal,
    });
  } catch { /* best-effort */ } finally { clearTimeout(timer); }
}

export default async function handler(req, res) {
  const c = String((req.query && req.query.c) || "BRL").toUpperCase();
  const provider = PROVIDERS[c];

  // Busca a fonte viva e o último-valor-bom em paralelo (ambos sob o mesmo timeout).
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  let liveRate = null, liveInflation = null, cached = null;
  try {
    const [live, row] = await Promise.all([
      provider ? provider(ctrl.signal).catch(() => [null, null]) : Promise.resolve([null, null]),
      readCache(c, ctrl.signal),
    ]);
    [liveRate, liveInflation] = live;
    cached = row;
  } catch { /* best-effort */ } finally { clearTimeout(timer); }

  // Mescla: o vivo manda; faltando, cai no último-valor-bom (nunca regride um número já real).
  const rate = liveRate != null ? liveRate : (cached ? toNum(cached.rate) : null);
  const inflation = liveInflation != null ? liveInflation : (cached ? toNum(cached.inflation) : null);

  // Pegou algo fresco? Persiste o melhor conjunto pra abastecer o próximo apagão de fonte.
  if (liveRate != null || liveInflation != null) await writeCache(c, rate, inflation);

  // Edge: longo só quando completo; curto quando falta algo, pra auto-curar sem congelar a lacuna.
  const complete = rate != null && inflation != null;
  res.setHeader(
    "Cache-Control",
    complete
      ? "public, s-maxage=21600, stale-while-revalidate=86400"
      : "public, s-maxage=120, stale-while-revalidate=600",
  );
  res.status(200).json({ rate, inflation, asOf: cached ? cached.updated_at : null });
}
