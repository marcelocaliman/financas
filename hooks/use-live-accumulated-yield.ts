"use client";

import { useEffect, useState } from "react";
import { dayUtilizationRatio } from "@/lib/financial/live-yield";

/**
 * Ticker do rendimento ACUMULADO LIFETIME (base + fração do dia atual).
 *
 * Diferente de `useLiveYield` (que mostra só o que rendeu hoje, resetando a
 * cada dia), este hook acumula desde a compra do ativo. O número:
 *  - Nunca vai a zero (a menos que o user saque o yield todo)
 *  - Durante o pregão (10h-18h BRT em dia útil): cresce suavemente adicionando
 *    `dailyYield × dayUtilizationRatio` ao base
 *  - Fora do pregão / fim de semana: trava no valor de fechamento (ratio=1 do
 *    último dia útil) — o próximo SSR atualiza o base com o dia já contabilizado
 *
 * Fórmula:
 *   accumulated = baseAccumulated + dailyYield × ratio
 *
 * onde:
 *   - baseAccumulated = derivedBalance − initial_amount (calculado no servidor)
 *   - dailyYield = derivedBalance × dailyRate (calculado no servidor)
 *   - ratio = dayUtilizationRatio(now) [0..1, cresce durante pregão]
 *
 * Estratégia SSR-safe:
 *  - estado inicial = baseAccumulated (sem tick, evita hydration mismatch)
 *  - após mount, atualiza com tick por interval de 1s
 */
export function useLiveAccumulatedYield(
  baseAccumulated: number,
  dailyYield: number,
) {
  const [accumulated, setAccumulated] = useState(baseAccumulated);

  useEffect(() => {
    setAccumulated(baseAccumulated);
    if (dailyYield <= 0) return;

    const tick = () => {
      const now = new Date();
      setAccumulated(baseAccumulated + dailyYield * dayUtilizationRatio(now));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [baseAccumulated, dailyYield]);

  return accumulated;
}
