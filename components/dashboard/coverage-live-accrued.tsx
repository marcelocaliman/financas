"use client";

import { useLiveYield } from "@/hooks/use-live-yield";
import { Money } from "@/components/ui/money";

/**
 * "Rendimento acumulado" da carteira de renda fixa.
 *
 *   = soma de (saldo − custo aplicado) de cada ativo de RF
 *   + parcela do yield do dia útil corrente até este instante (tic-tic visual)
 *
 * O número cresce a cada dia útil (yields creditados pelo cron),
 * é neutro em aportes (eleva saldo e custo igualmente), diminui em
 * saques de yield. Não reseta — espelha um Tesouro Selic real.
 */
export function CoverageLiveAccrued({
  accumulatedUntilToday,
  dailyYield,
}: {
  /** Rendimento acumulado até o início de hoje (saldo − custo aplicado) */
  accumulatedUntilToday: number;
  /** Yield esperado de hoje (R$/dia útil) — soma do tic-tic do dia */
  dailyYield: number;
}) {
  const { accumulated: todayParcel } = useLiveYield(dailyYield);
  const total = accumulatedUntilToday + todayParcel;
  return (
    <div className="mt-4 flex items-baseline gap-2 text-[12.5px] font-mono tabular-nums">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-olive-600 animate-pulse" />
      <span className="text-muted-foreground">Rendimento acumulado</span>
      <Money
        value={total}
        showComparison
        className="text-[14px] font-medium text-olive-700 dark:text-olive-500 inline-flex !flex-row !items-baseline"
        secondaryClassName="text-[10px] ml-1.5"
      />
    </div>
  );
}
