import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { adminApi } from "./api";
import type { RecentEvent } from "./types";

/** Quantas sessões do app estão abertas AGORA (presença anônima — conta, nunca quem). */
export function useOnlineCount(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const ch = supabase.channel("presence-online");
    const update = () => setN(Object.keys(ch.presenceState()).length);
    ch.on("presence", { event: "sync" }, update)
      .on("presence", { event: "join" }, update)
      .on("presence", { event: "leave" }, update)
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, []);
  return n;
}

/** Feed AO VIVO de eventos (anônimos): semeia com os recentes e anexa via Realtime. */
export function useLiveEvents(limit = 30): RecentEvent[] {
  const [events, setEvents] = useState<RecentEvent[]>([]);
  const limitRef = useRef(limit);
  limitRef.current = limit;
  useEffect(() => {
    let alive = true;
    adminApi
      .recentEvents(limitRef.current)
      .then((rows) => {
        if (alive) setEvents(rows ?? []);
      })
      .catch(() => {});
    const ch = supabase
      .channel("admin-live-events")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "app_events" },
        (payload) => {
          // Minimização: fica SÓ com os campos exibidos — descarta anon_id/path/props
          // (que chegam na linha bruta do Realtime e não têm uso na UI).
          const p = payload.new as Record<string, unknown>;
          const r: RecentEvent = {
            created_at: String(p.created_at ?? ""),
            surface: String(p.surface ?? ""),
            name: String(p.name ?? ""),
            country: (p.country as string | null) ?? null,
            device: (p.device as string | null) ?? null,
          };
          setEvents((prev) => {
            // dedupe: o snapshot inicial e o stream do Realtime podem coincidir.
            const h = prev[0];
            if (h && h.created_at === r.created_at && h.name === r.name && h.surface === r.surface) return prev;
            return [r, ...prev].slice(0, limitRef.current);
          });
        },
      )
      .subscribe();
    return () => {
      alive = false;
      void supabase.removeChannel(ch);
    };
  }, []);
  return events;
}
