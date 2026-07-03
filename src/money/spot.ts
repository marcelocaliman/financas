import type { Currency } from "./currency";

/**
 * Cotação de OURO (XAU, por onça-troy) e BITCOIN (BTC) — Coinbase (api.coinbase.com/v2/prices):
 * pública, SEM token, CORS liberado. Cotados SEMPRE em DÓLAR (convenção de mercado — ouro e cripto
 * são precificados em USD no mundo todo), independente da moeda principal do usuário.
 * Só dado público de mercado — NENHUM dado do usuário sai daqui (mesma pegada do câmbio/Frankfurter).
 * Módulo PURO/testável: `parseSpot` isolado; `fetchSpot` só monta a URL e valida a resposta.
 */

export const SPOT_ASSETS = ["XAU", "BTC"] as const;
export type SpotAsset = (typeof SPOT_ASSETS)[number];

/** Moeda em que ouro/bitcoin são cotados no ticker — dólar, o padrão desses mercados. */
export const QUOTE: Currency = "USD";

/**
 * Selo de cada ativo: cor POR TEMA (tons mais escuros no claro pra manter contraste — igual às
 * moedas em composition.ts) e unidade opcional. Tons contidos de commodity — sem neon/arco-íris.
 */
const ASSET_COLOR_DARK: Record<SpotAsset, string> = { XAU: "#C2A25A", BTC: "#E08A3C" };
const ASSET_COLOR_LIGHT: Record<SpotAsset, string> = { XAU: "#9C7E3A", BTC: "#B56A22" };
export const ASSET_META: Record<SpotAsset, { unit?: string }> = {
  XAU: { unit: "oz" },
  BTC: {},
};

export function assetColor(asset: SpotAsset, theme: "light" | "dark"): string {
  return (theme === "dark" ? ASSET_COLOR_DARK : ASSET_COLOR_LIGHT)[asset];
}

const ENDPOINT = "https://api.coinbase.com/v2/prices";

interface CoinbaseSpot {
  data?: { amount?: string; base?: string; currency?: string };
}

/** Preço (número > 0) da resposta da Coinbase, conferindo ativo e moeda. null se a resposta não bate. */
export function parseSpot(data: CoinbaseSpot, asset: SpotAsset, base: Currency): number | null {
  const d = data.data;
  if (!d || d.base !== asset || d.currency !== base) return null;
  const n = Number(d.amount);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Spot de `asset` na moeda `base`. `date` (AAAA-MM-DD) pega o fechamento daquele dia — usado pra
 * comparar hoje × ontem e mostrar a variação do dia. Lança em erro de rede/HTTP; devolve null se a
 * resposta vier fora do formato esperado (o chamador decide o fallback por-ativo).
 */
export async function fetchSpot(
  asset: SpotAsset,
  base: Currency,
  date?: string,
  signal?: AbortSignal,
): Promise<number | null> {
  const url = `${ENDPOINT}/${asset}-${base}/spot${date ? `?date=${date}` : ""}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`spot ${asset} HTTP ${res.status}`);
  return parseSpot((await res.json()) as CoinbaseSpot, asset, base);
}
