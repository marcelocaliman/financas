/**
 * Busca unificada: catálogo interno + Tesouro ao vivo + heurística.
 * Server-only.
 */

import "server-only";
import {
  type AssetTemplate,
  heuristicByTicker,
  searchStaticCatalog,
  STATIC_CATALOG,
} from "@/lib/financial/asset-catalog";
import { fetchTesouroVigentes } from "@/lib/financial/tesouro-direto";

export async function searchAssets(query: string, limit = 12): Promise<{
  results: AssetTemplate[];
  liveTesouro: boolean;
}> {
  const q = query.trim();
  if (!q) return { results: [], liveTesouro: false };

  // Catálogo interno primeiro (cache em memória, latência zero)
  const internal = searchStaticCatalog(q, limit);

  // Tesouro Direto ao vivo (cache 24h)
  const live = await fetchTesouroVigentes();
  const liveSelected: AssetTemplate[] = [];
  if (live) {
    const ql = q.toLowerCase();
    for (const item of live) {
      if (item.name.toLowerCase().includes(ql)) liveSelected.push(item);
    }
  }

  // Combina: vivo > catálogo (vivo é mais atualizado), depois preenche com heurística.
  const seen = new Set<string>();
  const combined: AssetTemplate[] = [];
  for (const item of [...liveSelected, ...internal]) {
    const key = item.ticker.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    combined.push(item);
    if (combined.length >= limit) break;
  }

  // Heurística de fallback se nada bateu mas o input parece um ticker B3
  if (combined.length === 0) {
    const guess = heuristicByTicker(q);
    if (guess) combined.push(guess);
  }

  return { results: combined.slice(0, limit), liveTesouro: live !== null };
}

/**
 * Match exato por nome/ticker. Usado quando o usuário cola um ticker no form.
 */
export async function resolveAsset(identifier: string): Promise<AssetTemplate | null> {
  const id = identifier.trim();
  if (!id) return null;
  const idLower = id.toLowerCase();

  // Catálogo estático
  const exactStatic = STATIC_CATALOG.find(
    (a) => a.ticker.toLowerCase() === idLower || a.name.toLowerCase() === idLower,
  );
  if (exactStatic) return exactStatic;

  // Live
  const live = await fetchTesouroVigentes();
  if (live) {
    const exactLive = live.find((a) => a.name.toLowerCase() === idLower);
    if (exactLive) return exactLive;
  }

  // Heurística
  return heuristicByTicker(id);
}
