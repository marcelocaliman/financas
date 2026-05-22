"use client";

import { useEffect, useState } from "react";
import { dayUtilizationRatio } from "@/lib/financial/live-yield";

/**
 * Devolve "rendimento acumulado hoje" subindo a cada segundo.
 *
 * Fórmula: accumulated = dailyYield × dayUtilizationRatio(now)
 *
 * dayUtilizationRatio cresce linearmente de 0 (10h BRT) até 1.0 (18h BRT)
 * durante o pregão. O resultado para em `dailyYield` às 18h e fica estável.
 *
 * O parâmetro `perSecond` é mantido na assinatura por compatibilidade com
 * call-sites antigos, mas IGNORADO — usar ele aqui dobrava a contagem
 * (perSecond * elapsed crescia à mesma taxa de dailyYield × ratio,
 * resultando em acumulador 2× mais rápido e sem cap).
 *
 * Estratégia SSR-safe:
 *  - estado inicial = 0 (servidor e cliente concordam; sem hydration mismatch)
 *  - após o mount no client, calcula valor real e atualiza por interval
 */
export function useLiveYield(dailyYield: number, _perSecond?: number) {
  const [accumulated, setAccumulated] = useState(0);
  const [mounted, setMounted] = useState(false);
  // _perSecond mantido só pra retrocompat; ignorado pra evitar dupla contagem
  void _perSecond;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    if (dailyYield <= 0) return;

    const tick = () => {
      const now = new Date();
      setAccumulated(dailyYield * dayUtilizationRatio(now));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [dailyYield]);

  return { accumulated, mounted };
}
