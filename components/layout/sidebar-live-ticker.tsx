"use client";

import { useEffect, useState } from "react";
import { MoneyMask } from "@/components/ui/privacy-provider";
import { formatMoney } from "@/lib/utils/format";

/**
 * Badge perene no rodapé da sidebar — "+R$ X/dia útil" pulsante.
 * Busca do endpoint /api/live e refresca a cada 5 minutos (não tem porque
 * pegar mais frequente, dailyYield muda 1× por dia quando o cron roda).
 */
export function SidebarLiveTicker() {
  const [dailyYield, setDailyYield] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch("/api/live", { cache: "no-store" });
        if (!r.ok) return;
        const { dailyYield: dy } = (await r.json()) as { dailyYield: number };
        if (alive) setDailyYield(dy);
      } catch {}
    }
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (dailyYield == null || dailyYield <= 0) return null;

  return (
    <div className="flex items-center justify-between px-3 py-1.5 rounded-[6px] bg-ink-900/40">
      <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-600 font-medium">
        Rendendo
      </span>
      <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-olive-500 tabular-nums font-medium">
        <span className="inline-block w-1 h-1 rounded-full bg-olive-600 animate-pulse" />
        +<MoneyMask>{formatMoney(dailyYield)}</MoneyMask>/dia
      </span>
    </div>
  );
}
