"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Escuta mudanças em tabelas do household via Supabase Realtime
 * e dá router.refresh() pra re-renderizar Server Components.
 *
 * Coalesce: agrupa múltiplos eventos em janela de 800ms pra evitar
 * thrashing quando muitas linhas mudam de uma vez (ex.: edição em massa).
 */
export function useRealtimeRefresh(tables: string[] = ["transactions", "accounts"]) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const triggerRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        router.refresh();
        timer = null;
      }, 800);
    };

    const channels = tables.map((table) =>
      supabase
        .channel(`realtime:${table}`)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .on("postgres_changes" as any, { event: "*", schema: "public", table }, triggerRefresh)
        .subscribe(),
    );

    return () => {
      if (timer) clearTimeout(timer);
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [router, tables]);
}
