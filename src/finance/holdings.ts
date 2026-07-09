import type { Asset } from "@/domain/types";
import type { TaxItem } from "@/domain/irpf";
import { CLASS } from "@/domain/taxonomy";

// Discriminação de POSIÇÕES dentro de um ativo (ticker/qtd/preço médio). Puro e testável. É só detalhe:
// não altera o valor total do ativo; serve pra ver o detalhado e pra o IRPF puxar uma linha por ticker.

/** Classes com unidades negociáveis onde discriminar posições faz sentido — e que declaram pelo CUSTO
 *  no IRPF. Fundos/renda fixa/conta/imóvel não entram (têm outra lógica de valor). */
export const HOLDINGS_CLASSES = new Set<string>([CLASS.acoes, CLASS.fiis, CLASS.cripto, CLASS.commodities, CLASS.privateEquity]);
export const isHoldingsClass = (classId: string): boolean => HOLDINGS_CLASSES.has(classId);

/** Custo total das posições: Σ quantidade × preço médio de aquisição. */
export function holdingsCost(holdings: { quantity: number; avgPrice: number }[] | undefined): number {
  return (holdings ?? []).reduce((s, h) => s + (h.quantity || 0) * (h.avgPrice || 0), 0);
}

/**
 * "Explode" um ativo discriminado em uma POSIÇÃO-ativo por holding (id determinístico `ativo::posição`),
 * pra o IRPF puxar uma linha por ticker. Ativos sem posições passam inalterados. Cada posição carrega
 * ticker/quantidade e `cost = qtd × preço médio` (o valor do IRPF nas classes de custo). O valor TOTAL
 * (amount) do ativo original não é usado aqui — não é alterado em lugar nenhum.
 */
export function explodeHoldings(assets: Asset[]): Asset[] {
  const out: Asset[] = [];
  for (const a of assets) {
    if (a.holdings && a.holdings.length) {
      for (const h of a.holdings) {
        const cost = (h.quantity || 0) * (h.avgPrice || 0);
        out.push({ ...a, id: `${a.id}::${h.id}`, holdings: undefined, ticker: h.ticker, quantity: h.quantity, avgPrice: h.avgPrice, cost, amount: cost, name: h.ticker || a.name });
      }
    } else {
      out.push(a);
    }
  }
  return out;
}

const baseId = (sourceId: string): string => sourceId.split("::")[0];

/**
 * Itens do IRPF que a DISCRIMINAÇÃO tornou obsoletos e devem ser removidos (limpeza de sync):
 *  - o bem AGREGADO ("Ações") depois que o ativo foi discriminado em posições;
 *  - uma POSIÇÃO antiga que foi apagada (mas o ativo ainda tem outras).
 * Regra: item de bem auto-puxado cujo `sourceId` NÃO é mais um ativo explodido válido, MAS a base do
 * ativo (antes do `::`) ainda existe → foi substituído pela discriminação. Se a base sumiu de vez
 * (ativo apagado), NÃO entra aqui (é órfão de verdade — o usuário decide). Nunca mexe em vendido/
 * excluído/manual. `explodedAssets` = patrimônio já explodido (posições viram ativos).
 */
export function supersededByHoldings(existing: TaxItem[], explodedAssets: Asset[]): string[] {
  const valid = new Set(explodedAssets.map((a) => a.id));
  const validBases = new Set([...valid].map(baseId));
  const out: string[] = [];
  for (const it of existing) {
    if (it.source !== "seed-asset" || !it.sourceId || it.disposed || it.excluded) continue;
    if (valid.has(it.sourceId)) continue; // ainda é um ativo/posição válido
    if (validBases.has(baseId(it.sourceId))) out.push(it.id); // base existe → substituído pela discriminação
  }
  return out;
}
