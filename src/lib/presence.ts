import { useEffect } from "react";
import { supabase } from "./supabase";

/**
 * Marca ESTA sessão do app como "online agora" — presença ANÔNIMA via Supabase
 * Realtime: chave aleatória por sessão, payload sem user_id/e-mail/PII. Serve só pro
 * painel admin CONTAR quantas sessões estão abertas (nunca quem). Efêmero (sai ao
 * fechar a aba). Canal público — sem dado financeiro, sem cookie.
 */
export function usePresenceTracker(): void {
  useEffect(() => {
    const key = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, "").slice(0, 16);
    const ch = supabase.channel("presence-online", { config: { presence: { key } } });
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") void ch.track({ online: true });
    });
    return () => {
      void supabase.removeChannel(ch);
    };
  }, []);
}
