import type { AssetSnapshot } from "@/services/quotes";

/**
 * Stub vazio — antes mostrava rendimento acumulado live tickando.
 * Sem compound, não há accumulatedYield real (sempre 0). Componente
 * mantido pra compat de import; sempre retorna "—".
 */
export function AssetLiveCell({ asset }: { asset: AssetSnapshot }) {
  void asset;
  return <span className="text-faint-foreground text-[11.5px]">—</span>;
}
