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
          const r = payload.new as RecentEvent;
          setEvents((prev) => [r, ...prev].slice(0, limitRef.current));
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
