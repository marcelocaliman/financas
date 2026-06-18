import { useEffect } from "react";

/**
 * Heartbeat de "online agora" do APP. A cada ~20s manda um ping anônimo pro coletor
 * de 1ª-parte (/api/presence) — sem cookie, sem PII, sem dado financeiro: só um id de
 * sessão aleatório (por aba) + surface 'app'. Robusto (não depende do RPC/auth do
 * Supabase nem do schema cache). Só roda com sessão autenticada (active).
 */
function sessionId(): string {
  try {
    let s = sessionStorage.getItem("nf-sid");
    if (!s) {
      s = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, "").slice(0, 32);
      sessionStorage.setItem("nf-sid", s);
    }
    return s;
  } catch {
    return Math.random().toString(36).slice(2, 18);
  }
}

function ping() {
  try {
    const body = JSON.stringify({ s: "app", id: sessionId() });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/presence", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/presence", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
    }
  } catch {
    /* best-effort */
  }
}

export function usePresenceTracker(active: boolean): void {
  useEffect(() => {
    if (!active) return; // só pinga com sessão autenticada
    ping();
    const id = setInterval(ping, 20_000);
    const onVis = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [active]);
}
