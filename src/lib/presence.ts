import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

/** Carimba o "último acesso" do usuário (metadado p/ medir retenção real no admin). Uma vez
 *  por sessão, no boot autenticado — independe de destravar o cofre. Best-effort. */
export async function markSeen(): Promise<void> {
  try {
    await supabase.rpc("mark_seen");
  } catch {
    /* best-effort — não bloqueia nada */
  }
}

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

/** `bye` (saída): remove a sessão JÁ, em vez de esperar a janela de 70s expirar — é o que
 *  torna o "sair" quase instantâneo no painel. Enviado no pagehide via sendBeacon (sobrevive
 *  ao unload). O heartbeat normal renova o last_seen. */
function ping(bye?: boolean) {
  try {
    const body = JSON.stringify({ s: "app", id: sessionId(), bye: bye ? 1 : undefined });
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
    const id = setInterval(() => ping(), 20_000);
    const onVis = () => {
      if (document.visibilityState === "visible") ping();
    };
    // Ao fechar a aba / navegar pra fora, avisa a saída SEMPRE (não só quando !persisted) → o
    // painel para de contar na hora, sem esperar a janela. Se a página voltar do bfcache, o
    // pageshow(persisted) re-pinga e ela reaparece. Isso torna o "sair" confiável.
    const onLeave = () => ping(true);
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) ping();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onLeave);
    window.addEventListener("pageshow", onShow);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onLeave);
      window.removeEventListener("pageshow", onShow);
    };
  }, [active]);
}
