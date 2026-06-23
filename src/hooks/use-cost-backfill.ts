import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { repository } from "@/data/dexie-repository";
import { actions } from "@/data/actions";

/**
 * Backfill ÚNICO por dispositivo: ativos vindos do modelo antigo (cotável) guardam
 * `quantity` + `avgPrice` mas NÃO têm `cost` (valor aplicado). Agora que tudo é VALOR
 * MANUAL por classe, o "valor aplicado" precisa estar preenchido p/ a rentabilidade
 * aparecer. Calcula `cost = quantidade × preço médio` para esses legados sem custo.
 * Idempotente (só preenche quando cost está vazio); roda 1× (flag em localStorage) e
 * respeita o usuário (se ele zerar o cost depois, a flag já marcada não refaz).
 */
const FLAG = "cost_backfill_qty_avgprice_v1";
let ran = false;

export function useCostBackfill(): void {
  const assets = useLiveQuery(() => repository.listAssets());
  useEffect(() => {
    if (ran || assets === undefined) return; // undefined = ainda carregando
    if (localStorage.getItem(FLAG)) {
      ran = true;
      return;
    }
    ran = true;
    localStorage.setItem(FLAG, "1");
    for (const a of assets) {
      const q = a.quantity ?? 0;
      const avg = a.avgPrice ?? 0;
      if ((a.cost ?? 0) <= 0 && q > 0 && avg > 0) {
        void actions.putAsset({ ...a, cost: Math.round(q * avg * 100) / 100 });
      }
    }
  }, [assets]);
}
