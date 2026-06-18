import { useEffect } from "react";
import { supabase } from "./supabase";

/**
 * Heartbeat de "online agora" — a cada ~25s a sessão (logada) renova o próprio
 * last_seen na tabela presence via RPC. O id da sessão é ALEATÓRIO e por-aba
 * (sessionStorage), sem user_id/PII: o servidor só sabe que "uma sessão está
 * aberta", nunca quem. O painel admin conta as sessões com ping recente.
 */
export function usePresenceTracker(): void {
  useEffect(() => {
    let sid = "";
    try {
      sid = sessionStorage.getItem("nf-sid") || "";
      if (!sid) {
        sid = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, "").slice(0, 32);
        sessionStorage.setItem("nf-sid", sid);
      }
    } catch {
      sid = Math.random().toString(36).slice(2, 18);
    }
    const ping = () => {
      void supabase.rpc("presence_ping", { p_session: sid, p_surface: "app" });
    };
    ping();
    const id = setInterval(ping, 25_000);
    const onVis = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
}
