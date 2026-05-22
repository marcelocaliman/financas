"use client";

import { useLiveYield } from "@/hooks/use-live-yield";
import { formatMoney } from "@/lib/utils/format";

/**
 * Saldo de um ativo que respira ao vivo no FlowDiagram da página /resgates.
 * Some o rendimento acumulado do dia ao saldo base.
 */
export function LiveBalance({
  baseBalance,
  dailyYield,
  perSecond,
}: {
  baseBalance: number;
  dailyYield: number;
  perSecond: number;
}) {
  const { accumulated } = useLiveYield(dailyYield, perSecond);
  const value = baseBalance + accumulated;
  return (
    <span className="font-mono tabular-nums">
      {formatMoney(value)}
    </span>
  );
}
