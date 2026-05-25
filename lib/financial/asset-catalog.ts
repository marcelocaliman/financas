/**
 * Catálogo interno de ativos conhecidos da B3.
 * Fonte de verdade pra preencher metadados quando o usuário só digitar o ticker.
 *
 * Não é exaustivo — é uma whitelist dos mais comuns. O resto cai em heurística
 * por padrão de ticker e/ou no fluxo manual.
 */

import type { AssetType, Indexer, TaxRegime } from "@/types/database";

export type AssetTemplate = {
  ticker: string;
  name: string;
  asset_type: AssetType;
  indexer?: Indexer | null;
  indexer_multiplier?: number | null;
  fixed_rate?: number | null;
  tax_regime: TaxRegime;
  source: "catalog" | "tesouro" | "heuristic";
  /** CNPJ da empresa/fundo (formato sem máscara, só dígitos). Auto-preenchido na Ficha IR. */
  cnpj?: string | null;
};

/* ============================== FIIs ===================================== */
// CNPJs dos FIIs: cada fundo é uma PJ separada, CNPJ do fundo (não da gestora).
// Fonte: CVM / B3 / sites das gestoras (Kinea, CSHG, XP, BTG, Vinci, RBR, BRPR).
const FIIS: AssetTemplate[] = [
  { ticker: "MXRF11", name: "Maxi Renda", cnpj: "97521225000140" },
  { ticker: "HGLG11", name: "CSHG Logística", cnpj: "11728688000147" },
  { ticker: "KNCR11", name: "Kinea Rendimentos Imobiliários", cnpj: "16706958000132" },
  { ticker: "KNRI11", name: "Kinea Renda Imobiliária", cnpj: "12005956000150" },
  { ticker: "HGRU11", name: "CSHG Renda Urbana", cnpj: "29641226000153" },
  { ticker: "BCFF11", name: "BTG Fundo de Fundos", cnpj: "11026627000110" },
  { ticker: "XPLG11", name: "XP Log", cnpj: "26502794000185" },
  { ticker: "VISC11", name: "Vinci Shopping Centers", cnpj: "17554274000125" },
  { ticker: "MALL11", name: "Malls Brasil Plural", cnpj: "26499833000132" },
  { ticker: "HGRE11", name: "CSHG Real Estate", cnpj: "09072017000129" },
  { ticker: "VILG11", name: "Vinci Logística", cnpj: "24960430000111" },
  { ticker: "RBRF11", name: "RBR Alpha Fundo de Fundos", cnpj: "27272616000114" },
  { ticker: "BTLG11", name: "BTG Logística", cnpj: "11839593000109" },
  { ticker: "RZTR11", name: "Riza Terrax", cnpj: "36502364000133" },
  { ticker: "HGCR11", name: "CSHG Recebíveis Imobiliários", cnpj: "11160521000122" },
  { ticker: "BRCR11", name: "BC Fund", cnpj: "08924783000125" },
  { ticker: "RECT11", name: "REC Renda Urbana", cnpj: "32274163000159" },
  { ticker: "JSRE11", name: "JS Real Estate", cnpj: "13371132000113" },
  { ticker: "RBRR11", name: "RBR Rendimento High Grade", cnpj: "29467038000125" },
  { ticker: "HSML11", name: "HSI Mall", cnpj: "32892018000123" },
].map((f) => ({
  ...f,
  asset_type: "fii" as AssetType,
  indexer: "none" as Indexer,
  tax_regime: "exempt" as TaxRegime,
  source: "catalog" as const,
}));

/* ============================== ETFs ===================================== */
// ETFs BlackRock (iShares) compartilham mesmo CNPJ-mãe; BB DTVM e Hashdex têm os seus.
const ETFS: AssetTemplate[] = [
  { ticker: "BOVA11", name: "iShares Ibovespa", cnpj: "10406511000161" },
  { ticker: "IVVB11", name: "iShares S&P 500", cnpj: "13927273000136" },
  { ticker: "SMAL11", name: "iShares Small Caps", cnpj: "10406501000125" },
  { ticker: "ECOO11", name: "iShares Carbono Eficiente", cnpj: "13691998000168" },
  { ticker: "DIVO11", name: "iShares Dividendos", cnpj: "10406493000189" },
  { ticker: "BBSD11", name: "BB ETF S&P Dividendos", cnpj: "10406493000189" },
  { ticker: "HASH11", name: "Hashdex Cripto", cnpj: "39838822000128" },
  { ticker: "FIND11", name: "iShares Financeiro", cnpj: "13691998000168" },
  { ticker: "MATB11", name: "iShares Materiais Básicos", cnpj: "13691998000168" },
  { ticker: "BOVV11", name: "iShares Ibovespa Mais Líquidas", cnpj: "32593566000182" },
].map((e) => ({
  ...e,
  asset_type: "etf" as AssetType,
  indexer: "none" as Indexer,
  tax_regime: "regressive" as TaxRegime,
  source: "catalog" as const,
}));

/* ============================== AÇÕES principais ========================= */
/**
 * Tickers terminados em 11 que são UNITS (ações compostas) ou BDRs, não FIIs.
 * Sem essa whitelist, a heurística erra e classifica como FII.
 */
// CNPJ-pai da empresa emissora (todas as classes PN/ON compartilham o mesmo).
const STOCK_UNITS: { ticker: string; name: string; cnpj: string }[] = [
  { ticker: "KLBN11", name: "Klabin Units", cnpj: "89637490000145" },
  { ticker: "SAPR11", name: "Sanepar Units", cnpj: "76484013000145" },
  { ticker: "TAEE11", name: "Taesa Units", cnpj: "07859971000130" },
  { ticker: "ALUP11", name: "Alupar Units", cnpj: "08364948000138" },
  { ticker: "ENGI11", name: "Energisa Units", cnpj: "00864214000106" },
  { ticker: "BIDI11", name: "Banco Inter Units", cnpj: "00416968000101" },
  { ticker: "SANB11", name: "Santander Units", cnpj: "90400888000142" },
  { ticker: "PINE11", name: "Banco Pine Units", cnpj: "62144175000120" },
];

const STOCKS: AssetTemplate[] = [
  { ticker: "PETR4", name: "Petrobras PN", cnpj: "33000167000101" },
  { ticker: "PETR3", name: "Petrobras ON", cnpj: "33000167000101" },
  { ticker: "VALE3", name: "Vale ON", cnpj: "33592510000154" },
  { ticker: "ITUB4", name: "Itaú Unibanco PN", cnpj: "60872504000123" },
  { ticker: "ITUB3", name: "Itaú Unibanco ON", cnpj: "60872504000123" },
  { ticker: "BBDC4", name: "Bradesco PN", cnpj: "60746948000112" },
  { ticker: "BBDC3", name: "Bradesco ON", cnpj: "60746948000112" },
  { ticker: "BBAS3", name: "Banco do Brasil ON", cnpj: "00000000000191" },
  { ticker: "ABEV3", name: "Ambev ON", cnpj: "07526557000100" },
  { ticker: "WEGE3", name: "WEG ON", cnpj: "84429695000111" },
  { ticker: "B3SA3", name: "B3 ON", cnpj: "09346601000125" },
  { ticker: "RENT3", name: "Localiza ON", cnpj: "16670085000155" },
  { ticker: "MGLU3", name: "Magazine Luiza ON", cnpj: "47960950000121" },
  { ticker: "ITSA4", name: "Itaúsa PN", cnpj: "61532644000115" },
  { ticker: "ITSA3", name: "Itaúsa ON", cnpj: "61532644000115" },
  { ticker: "LREN3", name: "Lojas Renner ON", cnpj: "92754738000162" },
  { ticker: "JBSS3", name: "JBS ON", cnpj: "02916265000160" },
  { ticker: "VIVT3", name: "Telefônica Brasil ON", cnpj: "02558157000162" },
  { ticker: "SUZB3", name: "Suzano ON", cnpj: "16404287000155" },
  { ticker: "RAIL3", name: "Rumo ON", cnpj: "02387241000160" },
  { ticker: "EQTL3", name: "Equatorial ON", cnpj: "03220438000173" },
  { ticker: "PRIO3", name: "PetroRio ON", cnpj: "10629105000168" },
  { ticker: "ELET3", name: "Eletrobras ON", cnpj: "00001180000126" },
  { ticker: "ELET6", name: "Eletrobras PNB", cnpj: "00001180000126" },
  { ticker: "GGBR4", name: "Gerdau PN", cnpj: "33611500000119" },
  { ticker: "CSNA3", name: "CSN ON", cnpj: "33042730000104" },
  { ticker: "USIM5", name: "Usiminas PNA", cnpj: "60894730000105" },
  { ticker: "CMIG4", name: "Cemig PN", cnpj: "17155730000164" },
  { ticker: "CPLE6", name: "Copel PNB", cnpj: "76483817000120" },
  { ticker: "SBSP3", name: "Sabesp ON", cnpj: "43776517000180" },
  { ticker: "TIMS3", name: "TIM ON", cnpj: "02421421000111" },
  { ticker: "RDOR3", name: "Rede D'Or ON", cnpj: "06047087000139" },
  { ticker: "HAPV3", name: "Hapvida ON", cnpj: "05197167000133" },
  { ticker: "GMAT3", name: "Grupo Mateus ON", cnpj: "12704179000139" },
  { ticker: "ASAI3", name: "Assaí ON", cnpj: "06057223000171" },
  ...STOCK_UNITS,
].map((s) => ({
  ...s,
  asset_type: "stock" as AssetType,
  indexer: "none" as Indexer,
  tax_regime: "exempt" as TaxRegime, // ações têm isenção até R$ 20k/mês
  source: "catalog" as const,
}));

const KNOWN_STOCK_UNITS = new Set(STOCK_UNITS.map((s) => s.ticker));

/* ============================== TESOUROS (fallback offline) ============== */
/**
 * Lista de fallback caso a API do Tesouro Direto esteja fora.
 * Mantida com títulos vigentes em 2026.
 */
const TESOUROS_FALLBACK: AssetTemplate[] = [
  // Selic (LFT)
  { ticker: "Tesouro Selic 2027", indexer: "selic", indexer_multiplier: 1.0 },
  { ticker: "Tesouro Selic 2029", indexer: "selic", indexer_multiplier: 1.0 },
  { ticker: "Tesouro Selic 2031", indexer: "selic", indexer_multiplier: 1.0 },
  // Prefixado (LTN/NTN-F)
  { ticker: "Tesouro Prefixado 2027", indexer: "fixed", fixed_rate: 10.0 },
  { ticker: "Tesouro Prefixado 2029", indexer: "fixed", fixed_rate: 10.5 },
  { ticker: "Tesouro Prefixado 2031", indexer: "fixed", fixed_rate: 10.8 },
  { ticker: "Tesouro Prefixado com Juros Semestrais 2031", indexer: "fixed", fixed_rate: 10.8 },
  { ticker: "Tesouro Prefixado com Juros Semestrais 2035", indexer: "fixed", fixed_rate: 11.0 },
  // IPCA+ (NTN-B)
  { ticker: "Tesouro IPCA+ 2029", indexer: "ipca", fixed_rate: 6.0 },
  { ticker: "Tesouro IPCA+ 2035", indexer: "ipca", fixed_rate: 6.3 },
  { ticker: "Tesouro IPCA+ 2045", indexer: "ipca", fixed_rate: 6.5 },
  { ticker: "Tesouro IPCA+ com Juros Semestrais 2032", indexer: "ipca", fixed_rate: 6.0 },
  { ticker: "Tesouro IPCA+ com Juros Semestrais 2035", indexer: "ipca", fixed_rate: 6.2 },
  { ticker: "Tesouro IPCA+ com Juros Semestrais 2045", indexer: "ipca", fixed_rate: 6.4 },
  { ticker: "Tesouro IPCA+ com Juros Semestrais 2055", indexer: "ipca", fixed_rate: 6.5 },
  // Renda+
  { ticker: "Tesouro RendA+ 2030", indexer: "ipca", fixed_rate: 6.0 },
  { ticker: "Tesouro RendA+ 2035", indexer: "ipca", fixed_rate: 6.2 },
  { ticker: "Tesouro RendA+ 2040", indexer: "ipca", fixed_rate: 6.3 },
  { ticker: "Tesouro RendA+ 2045", indexer: "ipca", fixed_rate: 6.4 },
  { ticker: "Tesouro RendA+ 2050", indexer: "ipca", fixed_rate: 6.5 },
  { ticker: "Tesouro RendA+ 2055", indexer: "ipca", fixed_rate: 6.5 },
  { ticker: "Tesouro RendA+ 2060", indexer: "ipca", fixed_rate: 6.5 },
  { ticker: "Tesouro RendA+ 2065", indexer: "ipca", fixed_rate: 6.5 },
].map((t) => ({
  ...t,
  name: t.ticker,
  asset_type: "fixed_income_public" as AssetType,
  tax_regime: "regressive" as TaxRegime,
  source: "catalog" as const,
})) as AssetTemplate[];

export const STATIC_CATALOG: AssetTemplate[] = [...FIIS, ...ETFS, ...STOCKS, ...TESOUROS_FALLBACK];

/**
 * Heurística: dado um ticker da B3 ainda não reconhecido, tenta inferir tipo
 * pelo padrão (FII tem sufixo "11"; ação tem 4 letras + dígito; ETF varia).
 */
export function heuristicByTicker(ticker: string): AssetTemplate | null {
  const t = ticker.trim().toUpperCase();
  if (!/^[A-Z]{3,5}\d{1,2}$/.test(t)) return null;

  // Units conhecidas (XXXX11 mas ação): tratamos como stock.
  if (KNOWN_STOCK_UNITS.has(t)) {
    return {
      ticker: t,
      name: t,
      asset_type: "stock",
      indexer: "none",
      tax_regime: "exempt",
      source: "heuristic",
    };
  }

  // Ticker XXXX11: pode ser FII, ETF ou Unit. Sem catálogo, evitamos chute —
  // marcamos como FII (caso mais comum) mas o user vê e pode trocar via avançado.
  // Em vez de assumir FII, agora retornamos null e o picker pede classificação manual.
  if (/^[A-Z]{4}11$/.test(t)) {
    return null;
  }

  // Ação: 4 letras + 3/4/5/6 (ON, PN, PNA, PNB)
  if (/^[A-Z]{4}[34568]$/.test(t)) {
    return {
      ticker: t,
      name: t,
      asset_type: "stock",
      indexer: "none",
      tax_regime: "exempt", // simplificação
      source: "heuristic",
    };
  }

  return null;
}

/**
 * Lookup direto pelo ticker. Usado pelo investment-sheet pra auto-popular CNPJ
 * quando o usuário escolhe um ativo do catálogo.
 */
export function lookupAssetCNPJ(ticker: string): string | null {
  const t = ticker.trim().toUpperCase();
  const hit = STATIC_CATALOG.find((a) => a.ticker.toUpperCase() === t);
  return hit?.cnpj ?? null;
}

/**
 * Match parcial case-insensitive contra nome e ticker.
 * Retorna até `limit` resultados, priorizando matches no início do nome.
 */
export function searchStaticCatalog(query: string, limit = 12): AssetTemplate[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const scored: { item: AssetTemplate; score: number }[] = [];
  for (const item of STATIC_CATALOG) {
    const name = item.name.toLowerCase();
    const ticker = item.ticker.toLowerCase();
    let score = -1;
    if (ticker === q) score = 100;
    else if (ticker.startsWith(q)) score = 80;
    else if (name.startsWith(q)) score = 60;
    else if (ticker.includes(q)) score = 40;
    else if (name.includes(q)) score = 30;
    if (score >= 0) scored.push({ item, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.item);
}
