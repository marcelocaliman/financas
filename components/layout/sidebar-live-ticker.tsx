"use client";

import { useEffect, useState } from "react";
import { MoneyMask } from "@/components/ui/privacy-provider";

/**
 * Badge perene no rodapé da sidebar — "+R$ X,XXXX/s" pulsante.
 * Busca do endpoint /api/live e refresca a cada 60s.
 */
export function SidebarLiveTicker() {
  const [perSecond, setPerSecond] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch("/api/live", { cache: "no-store" });
        if (!r.ok) return;
        const { perSecond: ps } = (await r.json()) as { perSecond: number };
        if (alive) setPerSecond(ps);
      } catch {}
    }
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (perSecond == null || perSecond <= 0) return null;

  return (
    <div className="flex items-center justify-between px-3 py-1.5 rounded-[6px] bg-ink-900/40">
      <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-600 font-medium">
        Rendendo
      </span>
      <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-olive-500 tabular-nums font-medium">
        <span className="inline-block w-1 h-1 rounded-full bg-olive-600 animate-pulse" />
        +R$ <MoneyMask>{perSecond.toFixed(4).replace(".", ",")}</MoneyMask>/s
      </span>
    </div>
  );
}
