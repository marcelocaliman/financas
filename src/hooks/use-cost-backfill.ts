import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { repository } from "@/data/dexie-repository";
import { actions } from "@/data/actions";

/**
 * Backfill do "valor aplicado": ativos vindos do modelo antigo (cotável) guardam
 * `quantity` + `avgPrice` mas NÃO têm `cost`. Agora que tudo é VALOR MANUAL por classe,
 * o "valor aplicado" precisa estar preenchido p/ a rentabilidade aparecer. Calcula
 * `cost = quantidade × preço médio` para esses legados sem custo.
 * IDEMPOTENTE (só preenche quando cost está vazio E há qtd × preço médio salvos); roda 1×
 * por SESSÃO e RE-TENTA a cada carregamento até preencher (sem trava permanente) — assim
 * funciona mesmo se rodou antes do vault carregar. Tudo no cliente (o dado é E2EE).
 */
let ran = false;

export function useCostBackfill(): void {
  const assets = useLiveQuery(() => repository.listAssets());
  useEffect(() => {
    if (ran || assets === undefined) return; // undefined = ainda carregando
    ran = true;
    for (const a of assets) {
      const q = a.quantity ?? 0;
      const avg = a.avgPrice ?? 0;
      if ((a.cost ?? 0) <= 0 && q > 0 && avg > 0) {
        void actions.putAsset({ ...a, cost: Math.round(q * avg * 100) / 100 });
      }
    }
  }, [assets]);
}
