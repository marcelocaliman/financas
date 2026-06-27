import { useEffect } from "react";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { useQuotes } from "@/store/quotes";
import { useCanLiveQuotes } from "@/hooks/use-live-quotes";
import { useIsAdmin } from "@/admin/use-admin";

/**
 * Mantém o valor dos ativos com ticker atualizado pela cotação automática (via /api/quote, que
 * tem cache COMPARTILHADO por símbolo). Quem sincroniza: super-admin sempre (uso pessoal do tier
 * free) e assinante do Pro Investidor quando a flag 'quotes_live' está ON. Roda no unlock, ao focar
 * a aba e a cada mudança de ativos, mas a atualização real é AGENDADA (ver isQuoteRefreshDue):
 * admin 4×/dia, Investidor de hora em hora, só em dia de pregão. Chamadas extras caem na guarda
 * da agenda — e, no servidor, o TTL do cache blinda o upstream independente do cliente.
 */
export function useQuotesSync(): void {
  const data = usePatrimonio();
  const canQuote = useCanLiveQuotes();
  const { isAdmin } = useIsAdmin();

  useEffect(() => {
    // Quem sincroniza: admin sempre (brapi free, 4×/dia); assinante do Pro Investidor só
    // quando a flag 'quotes_live' está ON (can_live_quotes / painel super-admin).
    // Cadência por tier: admin = 4×/dia (free); Pro Investidor pagante = de hora em hora.
    if (!data || !canQuote) return;
    const mode = isAdmin ? "admin" : "live";
    const run = () => void useQuotes.getState().refresh(data.assets, false, mode);
    run();
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", run);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", run);
    };
  }, [data, canQuote, isAdmin]);
}
