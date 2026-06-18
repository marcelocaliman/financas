import { useEffect, useState } from "react";
import { adminApi } from "./api";
import type { RecentEvent } from "./types";

// Polling near-real-time (robusto, sem depender do WebSocket de Realtime).
const POLL_MS = 12_000;

/** Quantas sessões do app estão abertas AGORA (heartbeat anônimo — conta, nunca quem). */
export function useOnlineCount(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () => {
      adminApi
        .onlineCount()
        .then((c) => {
          if (alive) setN(c ?? 0);
        })
        .catch(() => {});
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return n;
}

/** Feed de atividade recente (anônimo), atualizado a cada ~12s. */
export function useLiveEvents(limit = 24): RecentEvent[] {
  const [events, setEvents] = useState<RecentEvent[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () => {
      adminApi
        .recentEvents(limit)
        .then((rows) => {
          if (alive) setEvents(rows ?? []);
        })
        .catch(() => {});
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [limit]);
  return events;
}
