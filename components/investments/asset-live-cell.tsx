"use client";

import { useEffect, useState } from "react";
import type { LiveAssetMetrics } from "@/lib/financial/live-yield";
import { dayUtilizationRatio } from "@/lib/financial/live-yield";

/**
 * Célula compacta com o rendimento do ativo subindo a cada segundo.
 * Padrão React 19: derive everything from a `now` state, sem refs nem performance.now() no render.
 */
export function AssetLiveCell({ asset }: { asset: LiveAssetMetrics }) {
  const [now, setNow] = useState(() => Date.now());
  const [mountedAt] = useState(() => Date.now());

  useEffect(() => {
    if (asset.dailyYield <= 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [asset.dailyYield]);

  if (asset.dailyYield <= 0) {
    return <span className="text-faint-foreground text-[11.5px]">—</span>;
  }

  const elapsed = (now - mountedAt) / 1000;
  const accumulated =
    asset.dailyYield * dayUtilizationRatio(new Date(now)) + asset.perSecond * elapsed;

  return (
    <div className="flex flex-col items-end leading-tight">
      <div className="flex items-center gap-1.5 font-mono text-[12.5px] text-olive-700 dark:text-olive-500 font-medium tabular-nums">
        <span className="inline-block w-1 h-1 rounded-full bg-olive-600 animate-pulse" />
        + R$ {accumulated.toFixed(4).replace(".", ",")}
      </div>
      {asset.isEstimate ? (
        <span className="font-mono text-[9.5px] text-faint-foreground tracking-[0.06em] uppercase mt-0.5">
          estimado
        </span>
      ) : null}
    </div>
  );
}
