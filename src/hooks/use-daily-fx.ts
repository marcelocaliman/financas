import { useMemo } from "react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useUI } from "@/store/ui";
import { useFxHistory } from "@/store/fx-history";
import { fxDailyDelta, type FxDailyResult } from "@/money/fx-daily";

/**
 * Variação do patrimônio atribuível ao CÂMBIO entre o último fechamento e o anterior (posições
 * constantes), na moeda de exibição. Devolve null enquanto não há dados ou as duas pontas de
 * taxa. O bootstrap do histórico de câmbio é centralizado no App; aqui só lemos. E2EE intacto.
 */
export function useDailyFx(): FxDailyResult | null {
  const { data } = useDashboardData();
  const display = useUI((s) => s.displayCurrency);
  const today = useFxHistory((s) => s.today);
  const prev = useFxHistory((s) => s.prev);

  return useMemo(() => {
    if (!data || !today || !prev) return null;
    return fxDailyDelta(data.assets, data.liabilities, display, today, prev);
  }, [data, display, today, prev]);
}
