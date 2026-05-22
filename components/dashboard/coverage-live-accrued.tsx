"use client";

import { useLiveYield } from "@/hooks/use-live-yield";
import { MoneyMask } from "@/components/ui/privacy-provider";

/**
 * Pequena linha "Hoje você já recebeu R$ X,XXXX" que sobe a cada segundo.
 * Aparece embaixo da Renda do patrimônio no dashboard quando há yield ativo.
 */
export function CoverageLiveAccrued({
  dailyYield,
  perSecond,
}: {
  dailyYield: number;
  perSecond: number;
}) {
  const { accumulated } = useLiveYield(dailyYield, perSecond);
  return (
    <div className="mt-4 flex items-baseline gap-2 text-[12px] font-mono tabular-nums">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-olive-600 animate-pulse" />
      <span className="text-muted-foreground">Hoje você já recebeu</span>
      <b className="text-olive-700 dark:text-olive-500">
        R$ <MoneyMask>{accumulated.toFixed(4).replace(".", ",")}</MoneyMask>
      </b>
    </div>
  );
}
