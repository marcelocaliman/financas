/**
 * Indicadores macro por PAÍS/MOEDA — taxa básica de juros + inflação (12m). Públicos (não é
 * dado de usuário). `/api/macro?c=BRL|EUR|USD|GBP`. Best-effort: cada métrica que falha vira
 * null. Cacheado no edge (mudam pouco). Fontes oficiais, sem chave:
 *   BRL → Banco Central (SGS): Selic meta (432) + IPCA 12m (13522)
 *   EUR → BCE (Data Portal): taxa de depósito (DFR) + HICP anual (Eurostat)
 *   USD → NY Fed (EFFR) + BLS (CPI, YoY calculado do índice)
 *   GBP → BoE (Bank Rate) + ONS (CPI 12m, best-effort)
 */
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
  for (const cdid of ["l55o", "d7g7"]) {
    try {
      const r = await get(`https://api.ons.gov.uk/timeseries/${cdid}/dataset/mm23/data`, signal);
      if (!r.ok) continue;
      const j = await r.json();
      const months = j?.months ?? [];
      const v = months.length ? toNum(months[months.length - 1].value) : null;
      if (v != null) return v;
    } catch { /* tenta o próximo */ }
  }
  return null;
}

const PROVIDERS = {
  BRL: (s) => Promise.all([bcb(432, s), bcb(13522, s)]),
  EUR: (s) => Promise.all([ecb("FM/B.U2.EUR.4F.KR.DFR.LEV", s), ecb("ICP/M.U2.N.000000.4.ANR", s)]),
  USD: (s) => Promise.all([effr(s), blsCpiYoY(s)]),
  GBP: (s) => Promise.all([boeRate(s), onsCpi(s)]),
};

export default async function handler(req, res) {
  const c = String((req.query && req.query.c) || "BRL").toUpperCase();
  const provider = PROVIDERS[c];
  let rate = null, inflation = null;
  if (provider) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7000);
    try { [rate, inflation] = await provider(ctrl.signal); } catch { /* best-effort */ } finally { clearTimeout(timer); }
  }
  res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
  res.status(200).json({ rate, inflation });
}
