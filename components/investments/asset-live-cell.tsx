"use client";

import { useLiveAccumulatedYield } from "@/hooks/use-live-accumulated-yield";
import { MoneyMask } from "@/components/ui/privacy-provider";
import { formatMoney } from "@/lib/utils/format";
import type { LiveAssetMetrics } from "@/lib/financial/live-yield";

/**
 * Mostra o rendimento ACUMULADO LIFETIME do ativo (saldo derivado − aplicado),
 * tickando ao vivo durante o pregão. Substituiu a versão "só hoje" — agora
 * representa quanto o ativo já gerou de yield desde a compra, com o tick do
 * dia em curso.
 *
 * Quando o ativo não tem dailyYield (crypto, ação sem dividendos), mostra "—".
 */
export function AssetLiveCell({ asset }: { asset: LiveAssetMetrics }) {
  const base = asset.accumulatedYield ?? 0;
  const accumulated = useLiveAccumulatedYield(base, asset.dailyYield);

  if (asset.dailyYield <= 0 || asset.accumulatedYield == null) {
    return <span className="text-faint-foreground text-[11.5px]">—</span>;
  }

  return (
    <div className="flex flex-col items-end leading-tight">
      <div className="flex items-center gap-1.5 font-mono text-[12.5px] text-olive-700 dark:text-olive-500 font-medium tabular-nums">
        <span className="inline-block w-1 h-1 rounded-full bg-olive-600 animate-pulse" />
        + <MoneyMask>{formatMoney(accumulated)}</MoneyMask>
      </div>
      {asset.isEstimate ? (
        <span className="font-mono text-[9.5px] text-faint-foreground tracking-[0.06em] uppercase mt-0.5">
          estimado
        </span>
      ) : null}
    </div>
  );
}
