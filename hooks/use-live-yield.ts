"use client";

import { useEffect, useState } from "react";
import { dayUtilizationRatio } from "@/lib/financial/live-yield";

/**
 * Hook que devolve "rendimento acumulado hoje" subindo a cada segundo.
 *
 * @param dailyYield  rendimento esperado no dia útil (R$)
 * @param perSecond   R$/s (já dividido por SECONDS_PER_UTIL_DAY)
 *
 * Retorna { accumulated, mounted } — `mounted=false` no SSR pra evitar
 * flicker; consumidores devem renderizar valor "estável" antes do mount.
 */
export function useLiveYield(dailyYield: number, perSecond: number) {
  const [now, setNow] = useState(() => Date.now());
  const [mountedAt] = useState(() => Date.now());

  useEffect(() => {
    if (dailyYield <= 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [dailyYield]);

  const elapsed = (now - mountedAt) / 1000;
  const accumulated = dailyYield * dayUtilizationRatio(new Date(now)) + perSecond * elapsed;
  return { accumulated, mounted: true };
}
