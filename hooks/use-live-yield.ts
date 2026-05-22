"use client";

import { useEffect, useState } from "react";
import { dayUtilizationRatio } from "@/lib/financial/live-yield";

/**
 * Devolve "rendimento acumulado hoje" subindo a cada segundo.
 *
 * Estratégia SSR-safe:
 *  - estado inicial = 0 (servidor e cliente concordam; sem hydration mismatch)
 *  - após o mount no client, calcula valor real e atualiza por interval
 */
export function useLiveYield(dailyYield: number, perSecond: number) {
  const [accumulated, setAccumulated] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    if (dailyYield <= 0) return;
    const startedAt = Date.now();

    const tick = () => {
      const now = new Date();
      const elapsed = (now.getTime() - startedAt) / 1000;
      const acc = dailyYield * dayUtilizationRatio(now) + perSecond * elapsed;
      setAccumulated(acc);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [dailyYield, perSecond]);

  return { accumulated, mounted };
}
