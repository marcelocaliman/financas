"use client";

import { useEffect, useState } from "react";

/**
 * Anima de 0 (ou `from`) até `value` em `duration` ms.
 * `format` controla a renderização (padrão: BRL inteiro).
 *
 * NÃO chamamos requestAnimationFrame em loop — usamos easing direto no estado.
 */
export function RollingNumber({
  value,
  duration = 900,
  from = 0,
  format,
}: {
  value: number;
  duration?: number;
  from?: number;
  format?: (n: number) => string;
}) {
  const [current, setCurrent] = useState(from);

  useEffect(() => {
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setCurrent(from + (value - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, from]);

  return <>{format ? format(current) : Math.round(current).toLocaleString("pt-BR")}</>;
}
