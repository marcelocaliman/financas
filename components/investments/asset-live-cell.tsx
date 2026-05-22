"use client";

import { useLiveYield } from "@/hooks/use-live-yield";
import type { LiveAssetMetrics } from "@/lib/financial/live-yield";

export function AssetLiveCell({ asset }: { asset: LiveAssetMetrics }) {
  const { accumulated } = useLiveYield(asset.dailyYield, asset.perSecond);

  if (asset.dailyYield <= 0) {
    return <span className="text-faint-foreground text-[11.5px]">—</span>;
  }

  return (
    <div className="flex flex-col items-end leading-tight">
      <div className="flex items-center gap-1.5 font-mono text-[12.5px] text-olive-700 dark:text-olive-500 font-medium tabular-nums">
        <span className="inline-block w-1 h-1 rounded-full bg-olive-600 animate-pulse" />
        + R$ {accumulated.toFixed(2).replace(".", ",")}
      </div>
      {asset.isEstimate ? (
        <span className="font-mono text-[9.5px] text-faint-foreground tracking-[0.06em] uppercase mt-0.5">
          estimado
        </span>
      ) : null}
    </div>
  );
}
