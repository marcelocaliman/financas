"use client";

import { useEffect, useState } from "react";
import { Money } from "@/components/ui/money";
import { isBusinessDay } from "@/lib/financial/business-days";

/**
 * "Rendimento acumulado" da carteira de renda fixa — matematicamente
 * coerente com a realidade da Selic/CDI/IPCA+ (base 252 dias úteis).
 *
 * Fórmula:
 *   total(now) = accumulatedFromServer
 *              + (dailyYield / 86400) × businessSecondsElapsed
 *
 * - `accumulatedFromServer`: ponto sólido do server render. Já reflete
 *   composição contínua até o momento do fetch (via deriveCheckpointBalance
 *   que usa businessDaysSinceContinuous excluindo fim de semana/feriados).
 * - `businessSecondsElapsed`: conta APENAS segundos transcorridos em
 *   dias úteis desde o mount. Em fins de semana/feriados, o tic-tic
 *   pausa naturalmente.
 *
 * Quando passa da meia-noite ou começa fim de semana: a função
 * `isBusinessDay` reavalia em cada tick, então o ritmo se ajusta.
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
  const [businessSecondsElapsed, setBusinessSecondsElapsed] = useState(0);

  useEffect(() => {
    if (dailyYield <= 0) return;
    let lastTick = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const delta = (now - lastTick) / 1000;
      lastTick = now;
      // Só conta o segundo se "agora" (em SP) é dia útil
      if (isBusinessDay(new Date(now))) {
        setBusinessSecondsElapsed((s) => s + delta);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [dailyYield]);

  const ratePerSecond = dailyYield / 86400;
  const total = accumulatedUntilToday + ratePerSecond * businessSecondsElapsed;

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
        value={total}
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
