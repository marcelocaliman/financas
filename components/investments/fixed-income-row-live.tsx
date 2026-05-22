"use client";

import { useLiveYield } from "@/hooks/use-live-yield";
import { formatMoney, formatPercent } from "@/lib/utils/format";
import type { LiveAssetMetrics } from "@/lib/financial/live-yield";

/**
 * Cells client-side da linha de Renda Fixa que precisam pulsar a cada
 * segundo: saldo atual + variação em R$ e %. Tudo derivado do
 * `baseBalance` (checkpoint composto) + acumulado do dia via useLiveYield.
 *
 * O resto da linha (ticker, indexador, ações) fica como server-rendered.
 */

export function LiveSaldoCell({ asset, fallback }: { asset: LiveAssetMetrics; fallback: number }) {
  const { accumulated } = useLiveYield(asset.dailyYield, asset.perSecond);
  const saldo = asset.baseBalance + accumulated;
  return (
    <span className="font-mono text-[13px] font-medium tabular-nums">
      {formatMoney(saldo > 0 ? saldo : fallback)}
    </span>
  );
}

export function LiveVariationCell({
  asset,
  initialAmount,
}: {
  asset: LiveAssetMetrics;
  initialAmount: number;
}) {
  const { accumulated } = useLiveYield(asset.dailyYield, asset.perSecond);
  const saldo = asset.baseBalance + accumulated;
  const delta = saldo - initialAmount;
  const deltaPct = initialAmount > 0 ? delta / initialAmount : 0;

  if (Math.abs(delta) < 0.005) {
    return <span className="text-faint-foreground font-mono text-[12.5px]">—</span>;
  }

  const tone =
    delta > 0
      ? "text-olive-700 dark:text-olive-500"
      : "text-rust-600";
  const sign = delta > 0 ? "+" : "";

  return (
    <div className="flex flex-col items-end leading-tight">
      <span className={`font-mono text-[12.5px] font-medium ${tone}`}>
        {sign}
        {formatPercent(deltaPct, 2)}
      </span>
      <span className={`font-mono text-[10.5px] ${tone} mt-0.5 tabular-nums`}>
        {sign}
        {formatMoney(delta)}
      </span>
    </div>
  );
}
