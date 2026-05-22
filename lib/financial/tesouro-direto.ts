/**
 * Lê títulos vigentes do Tesouro Direto via endpoint público B3.
 * Cache de 24h via `revalidate` do Next fetch.
 * Fallback gracioso: se a API der erro, devolve null e quem chama usa o catálogo interno.
 */

import type { AssetTemplate } from "./asset-catalog";

const ENDPOINT =
  "https://www.tesourodireto.com.br/json/br/com/b3/tesourodireto/service/api/treasurybondsinfo.json";

type RawBondsResponse = {
  response?: {
    TrsrBdTradgList?: Array<{
      TrsrBd?: {
        nm?: string;
        FinIndxs?: { cd?: number; nm?: string };
        anulInvstmtRate?: number;
        mtrtyDt?: string;
        featrs?: string;
        isinCd?: string;
      };
    }>;
  };
};

function mapIndexer(name?: string): { indexer: AssetTemplate["indexer"]; fixed_rate?: number } {
  if (!name) return { indexer: "fixed" };
  const n = name.toUpperCase();
  if (n.includes("SELIC")) return { indexer: "selic" };
  if (n.includes("IPCA")) return { indexer: "ipca" };
  if (n.includes("PRÉ") || n.includes("PRE")) return { indexer: "fixed" };
  return { indexer: "fixed" };
}

/**
 * Tenta carregar e padronizar os títulos vigentes.
 * Cacheado 24h. Retorna null se a API falhar ou time-out (3s).
 */
export async function fetchTesouroVigentes(): Promise<AssetTemplate[] | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(ENDPOINT, {
      signal: controller.signal,
      next: { revalidate: 60 * 60 * 24 }, // 24h
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    const json = (await res.json()) as RawBondsResponse;
    const list = json.response?.TrsrBdTradgList ?? [];

    const out: AssetTemplate[] = [];
    for (const item of list) {
      const bond = item.TrsrBd;
      if (!bond?.nm) continue;
      const { indexer } = mapIndexer(bond.FinIndxs?.nm ?? bond.nm);
      const rate = typeof bond.anulInvstmtRate === "number"
        ? Math.round(bond.anulInvstmtRate * 100) / 100
        : undefined;
      out.push({
        ticker: bond.nm,
        name: bond.nm,
        asset_type: "fixed_income_public",
        indexer,
        indexer_multiplier: indexer === "selic" ? 1.0 : null,
        fixed_rate: indexer === "fixed" || indexer === "ipca" ? rate ?? null : null,
        tax_regime: "regressive",
        source: "tesouro",
      });
    }
    return out;
  } catch {
    return null;
  }
}
