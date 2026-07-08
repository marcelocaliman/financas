import type { TaxItem } from "@/domain/irpf";
import { SHARED_OWNER } from "@/domain/irpf";
import type { Income } from "@/domain/types";

// Lógica de DECLARAÇÃO SEPARADA (casal): cada bem/renda tem um dono e cada declaração é uma VISÃO
// filtrada por declarante — bens comuns entram nas duas, divididos por sharePct. Puro e testável.
// No modo CONJUNTO nada disso é usado (um documento cobre tudo).

/** Um item pertence à declaração de `declaranteId`? Comum entra em todas; sem dono cai no primário. */
export function belongsTo(item: { ownerId?: string }, declaranteId: string, primaryId: string): boolean {
  if (item.ownerId === SHARED_OWNER) return true;
  if (item.ownerId == null || item.ownerId === "") return declaranteId === primaryId;
  return item.ownerId === declaranteId;
}

/** Divide um bem COMUM pelo sharePct (default 50) — o valor que entra em CADA declaração. Não-comum
 *  passa igual. Aplica a todas as colunas (ano-base/anterior, moeda e BRL do exterior). */
export function applyShare(item: TaxItem): TaxItem {
  if (item.ownerId !== SHARED_OWNER) return item;
  const f = (item.sharePct ?? 50) / 100;
  const mul = (v?: number) => (v == null ? v : Math.round(v * f * 100) / 100);
  return {
    ...item,
    valorAnoBase: mul(item.valorAnoBase) ?? 0,
    valorAnoAnterior: mul(item.valorAnoAnterior),
    valorBrlAnoBase: mul(item.valorBrlAnoBase),
    valorBrlAnoAnterior: mul(item.valorBrlAnoAnterior),
  };
}

/** Itens da declaração de um declarante: filtra por dono e JÁ divide os comuns (pronto p/ export). */
export function itemsForDeclarante(items: TaxItem[], declaranteId: string, primaryId: string): TaxItem[] {
  return items.filter((i) => belongsTo(i, declaranteId, primaryId)).map(applyShare);
}

/** Renda de um declarante: personId === declarante, ou sem pessoa → cai no primário. */
export function incomesForDeclarante(incomes: Income[], declaranteId: string, primaryId: string): Income[] {
  return incomes.filter((i) => (i.personId == null || i.personId === "" ? declaranteId === primaryId : i.personId === declaranteId));
}
