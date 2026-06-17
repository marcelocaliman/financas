import { useQuotesSync } from "@/hooks/use-quotes-sync";
import { useAutoSnapshot } from "@/hooks/use-auto-snapshot";
import { useMainCurrency } from "@/hooks/use-main-currency";
import { useTaxonomyBackfill } from "@/hooks/use-taxonomy-backfill";

/**
 * Efeitos de boot do app (pós-unlock): cotações dos ativos, snapshot automático do mês,
 * hidratação da moeda principal do cofre e backfill da taxonomia. Centralizados num único
 * hook pra rodarem em QUALQUER casca (V1 ou V2) sem divergir. Chame no topo da casca.
 */
export function useAppBoot(): void {
  useQuotesSync();
  useAutoSnapshot();
  useMainCurrency(); // só pelo efeito de hidratar a moeda principal (retorno ignorado)
  useTaxonomyBackfill();
}
