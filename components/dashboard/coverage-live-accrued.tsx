"use client";

import { useEffect, useState } from "react";
import { Money } from "@/components/ui/money";

/**
 * "Rendimento acumulado" da carteira de renda fixa — sempre crescendo,
 * sem reset diário, sem janela morta. Espelha um Tesouro Selic mantido
 * pela vida toda.
 *
 * Fórmula:
 *   total(now) = accumulatedFromServer
 *              + (dailyYield / 86400) × secondsSinceMount
 *
 * - `accumulatedFromServer`: ponto sólido fornecido pelo server
 *   (Σ derivedBalance − initial_amount de cada ativo de RF). Reflete
 *   yields já compostos pelo cron até o momento do server render.
 * - `dailyYield / 86400`: taxa contínua distribuída em 24h. Anima
 *   suavemente entre cargas; reconcilia com o real a cada refresh.
 *
 * Trade-off: em fim de semana o número segue animando mesmo que Selic
 * D+1 não renda matematicamente. Aceitável — é uma representação
 * visual contínua; a fonte da verdade segue sendo o `current_balance`
 * no banco que se atualiza pelo cron.
 */
export function CoverageLiveAccrued({
  accumulatedUntilToday,
  dailyYield,
}: {
  /** Rendimento acumulado até o momento do server render (saldo − custo) */
  accumulatedUntilToday: number;
  /** Yield esperado por dia útil (R$/dia) — taxa */
  dailyYield: number;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [mountedAt] = useState(() => Date.now());

  useEffect(() => {
    if (dailyYield <= 0) return;
    const id = setInterval(() => {
      setElapsed((Date.now() - mountedAt) / 1000);
    }, 1000);
    return () => clearInterval(id);
  }, [dailyYield, mountedAt]);

  // Taxa contínua: dailyYield distribuído ao longo de 86400s = 24h.
  // Anima sempre, sem reset, sem parar.
  const ratePerSecond = dailyYield / 86400;
  const total = accumulatedUntilToday + ratePerSecond * elapsed;

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
