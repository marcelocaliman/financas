"use client";

import { Money } from "@/components/ui/money";

/**
 * "Rendimento acumulado" da carteira de renda fixa — número estático.
 *
 * Selic/Tesouro rendem em incrementos DIÁRIOS quando o cron roda às 06h BRT
 * (não por segundo). O valor exibido vem do server, com today's fraction
 * já incluída no derivedBalance. Refresh da página re-busca.
 */
export function CoverageLiveAccrued({
  accumulatedUntilToday,
  dailyYield,
  isBusinessDayToday,
}: {
  accumulatedUntilToday: number;
  dailyYield: number;
  isBusinessDayToday: boolean;
}) {
  void dailyYield;

  return (
    <div className="mt-4 flex items-baseline gap-2 text-[12.5px] font-mono tabular-nums">
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${
          isBusinessDayToday ? "bg-olive-600 animate-pulse" : "bg-faint-foreground"
        }`}
        title={isBusinessDayToday ? "Rendendo" : "Pausado (fim de semana / feriado)"}
      />
      <span className="text-muted-foreground">Rendimento acumulado</span>
      <Money
        value={accumulatedUntilToday}
        showComparison
        className="text-[14px] font-medium text-olive-700 dark:text-olive-500 inline-flex !flex-row !items-baseline"
        secondaryClassName="text-[10px] ml-1.5"
      />
      {!isBusinessDayToday ? (
        <span className="text-[10.5px] text-faint-foreground italic ml-1">pausado</span>
      ) : null}
    </div>
  );
}
