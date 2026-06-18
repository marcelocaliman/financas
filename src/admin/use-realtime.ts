import { useEffect, useState } from "react";
import { adminApi } from "./api";
import type { RecentEvent, OnlinePresence } from "./types";

// Polling near-real-time (robusto, sem depender do WebSocket de Realtime).
const POLL_MS = 12_000;
const EMPTY_PRESENCE: OnlinePresence = { app: 0, landing: 0, total: 0 };

/** "Online agora" por superfície: app (logados) + landing (anônimos). Heartbeat,
 *  conta, nunca quem. Atualiza por polling a cada ~12s. */
export function useOnlinePresence(): OnlinePresence {
  const [p, setP] = useState<OnlinePresence>(EMPTY_PRESENCE);
  useEffect(() => {
    let alive = true;
    const load = () => {
      adminApi
        .online()
        .then((d) => {
          if (alive && d) setP(d);
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
  return p;
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
