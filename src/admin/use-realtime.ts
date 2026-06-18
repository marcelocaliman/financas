import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { adminApi } from "./api";
import type { RecentEvent } from "./types";

// ── Presença "online agora" — UM único canal compartilhado ───────────────────
// Vários hooks (Visão geral + Analytics) querem a contagem ao mesmo tempo; criar
// dois canais com o MESMO tópico ("presence-online") quebra o Realtime. Então
// mantemos um canal singleton com ref-count e avisamos todos os assinantes.
type Sub = (n: number) => void;
let presenceChannel: ReturnType<typeof supabase.channel> | null = null;
let presenceCount = 0;
let presenceRefs = 0;
const presenceSubs = new Set<Sub>();

function ensurePresence() {
  presenceRefs++;
  if (presenceChannel) return;
  try {
    const ch = supabase.channel("presence-online");
    presenceChannel = ch;
    const update = () => {
      try {
        presenceCount = Object.keys(ch.presenceState()).length;
      } catch {
        presenceCount = 0;
      }
      presenceSubs.forEach((cb) => cb(presenceCount));
    };
    ch.on("presence", { event: "sync" }, update)
      .on("presence", { event: "join" }, update)
      .on("presence", { event: "leave" }, update)
      .subscribe();
  } catch {
    presenceChannel = null; // Realtime indisponível → fica 0, sem quebrar
  }
}

function releasePresence() {
  presenceRefs = Math.max(0, presenceRefs - 1);
  if (presenceRefs === 0 && presenceChannel) {
    try { void supabase.removeChannel(presenceChannel); } catch { /* ignore */ }
    presenceChannel = null;
  }
}

/** Quantas sessões do app estão abertas AGORA (presença anônima — conta, nunca quem). */
export function useOnlineCount(): number {
  const [n, setN] = useState(presenceCount);
  useEffect(() => {
    const cb: Sub = (v) => setN(v);
    presenceSubs.add(cb);
    ensurePresence();
    setN(presenceCount);
    return () => {
      presenceSubs.delete(cb);
      releasePresence();
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
    let ch: ReturnType<typeof supabase.channel> | null = null;
    // Snapshot inicial (não depende do Realtime).
    adminApi
      .recentEvents(limitRef.current)
      .then((rows) => {
        if (alive) setEvents(rows ?? []);
      })
      .catch(() => {});
    // Stream ao vivo — se o Realtime falhar, o painel segue com o snapshot.
    try {
      ch = supabase
        .channel("admin-live-events")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "app_events" },
          (payload) => {
            // Minimização: fica SÓ com os campos exibidos — descarta anon_id/path/props.
            const p = (payload.new ?? {}) as Record<string, unknown>;
            const r: RecentEvent = {
              created_at: String(p.created_at ?? ""),
              surface: String(p.surface ?? ""),
              name: String(p.name ?? ""),
              country: (p.country as string | null) ?? null,
              device: (p.device as string | null) ?? null,
            };
            setEvents((prev) => {
              const h = prev[0];
              if (h && h.created_at === r.created_at && h.name === r.name && h.surface === r.surface) return prev;
              return [r, ...prev].slice(0, limitRef.current);
            });
          },
        )
        .subscribe();
    } catch {
      /* Realtime indisponível → só o snapshot */
    }
    return () => {
      alive = false;
      if (ch) try { void supabase.removeChannel(ch); } catch { /* ignore */ }
    };
  }, []);
  return events;
}
