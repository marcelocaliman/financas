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
};

/* ============================== FIIs ===================================== */
const FIIS: AssetTemplate[] = [
  { ticker: "MXRF11", name: "Maxi Renda" },
  { ticker: "HGLG11", name: "CSHG Logística" },
  { ticker: "KNCR11", name: "Kinea Rendimentos Imobiliários" },
  { ticker: "KNRI11", name: "Kinea Renda Imobiliária" },
  { ticker: "HGRU11", name: "CSHG Renda Urbana" },
  { ticker: "BCFF11", name: "BTG Fundo de Fundos" },
  { ticker: "XPLG11", name: "XP Log" },
  { ticker: "VISC11", name: "Vinci Shopping Centers" },
  { ticker: "MALL11", name: "Malls Brasil Plural" },
  { ticker: "HGRE11", name: "CSHG Real Estate" },
  { ticker: "VILG11", name: "Vinci Logística" },
  { ticker: "RBRF11", name: "RBR Alpha Fundo de Fundos" },
  { ticker: "BTLG11", name: "BTG Logística" },
  { ticker: "RZTR11", name: "Riza Terrax" },
  { ticker: "HGCR11", name: "CSHG Recebíveis Imobiliários" },
  { ticker: "BRCR11", name: "BC Fund" },
  { ticker: "RECT11", name: "REC Renda Urbana" },
  { ticker: "JSRE11", name: "JS Real Estate" },
  { ticker: "RBRR11", name: "RBR Rendimento High Grade" },
  { ticker: "HSML11", name: "HSI Mall" },
].map((f) => ({
  ...f,
  asset_type: "fii" as AssetType,
  indexer: "none" as Indexer,
  tax_regime: "exempt" as TaxRegime,
  source: "catalog" as const,
}));

/* ============================== ETFs ===================================== */
const ETFS: AssetTemplate[] = [
  { ticker: "BOVA11", name: "iShares Ibovespa" },
  { ticker: "IVVB11", name: "iShares S&P 500" },
  { ticker: "SMAL11", name: "iShares Small Caps" },
  { ticker: "ECOO11", name: "iShares Carbono Eficiente" },
  { ticker: "DIVO11", name: "iShares Dividendos" },
  { ticker: "BBSD11", name: "BB ETF S&P Dividendos" },
  { ticker: "HASH11", name: "Hashdex Cripto" },
  { ticker: "FIND11", name: "iShares Financeiro" },
  { ticker: "MATB11", name: "iShares Materiais Básicos" },
  { ticker: "BOVV11", name: "iShares Ibovespa Mais Líquidas" },
].map((e) => ({
  ...e,
  asset_type: "etf" as AssetType,
  indexer: "none" as Indexer,
  tax_regime: "regressive" as TaxRegime,
  source: "catalog" as const,
}));

/* ============================== AÇÕES principais ========================= */
const STOCKS: AssetTemplate[] = [
  { ticker: "PETR4", name: "Petrobras PN" },
  { ticker: "PETR3", name: "Petrobras ON" },
  { ticker: "VALE3", name: "Vale ON" },
  { ticker: "ITUB4", name: "Itaú Unibanco PN" },
  { ticker: "BBDC4", name: "Bradesco PN" },
  { ticker: "BBAS3", name: "Banco do Brasil ON" },
  { ticker: "ABEV3", name: "Ambev ON" },
  { ticker: "WEGE3", name: "WEG ON" },
  { ticker: "B3SA3", name: "B3 ON" },
  { ticker: "RENT3", name: "Localiza ON" },
  { ticker: "MGLU3", name: "Magazine Luiza ON" },
  { ticker: "ITSA4", name: "Itaúsa PN" },
  { ticker: "LREN3", name: "Lojas Renner ON" },
  { ticker: "JBSS3", name: "JBS ON" },
  { ticker: "VIVT3", name: "Telefônica Brasil ON" },
  { ticker: "SUZB3", name: "Suzano ON" },
  { ticker: "RAIL3", name: "Rumo ON" },
  { ticker: "EQTL3", name: "Equatorial ON" },
  { ticker: "PRIO3", name: "PetroRio ON" },
  { ticker: "ELET3", name: "Eletrobras ON" },
].map((s) => ({
  ...s,
  asset_type: "stock" as AssetType,
  indexer: "none" as Indexer,
  tax_regime: "exempt" as TaxRegime, // ações têm isenção até R$ 20k/mês
  source: "catalog" as const,
}));

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

  // FII: 4 letras + "11" → quase sempre FII (alguns ETFs também terminam em 11 mas estão no catálogo)
  if (/^[A-Z]{4}11$/.test(t)) {
    return {
      ticker: t,
      name: t,
      asset_type: "fii",
      indexer: "none",
      tax_regime: "exempt",
      source: "heuristic",
    };
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
