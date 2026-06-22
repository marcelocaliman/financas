import { useEffect } from "react";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { useQuotes } from "@/store/quotes";
import { useIsAdmin } from "@/admin/use-admin";

/**
 * Mantém o valor dos ativos com ticker atualizado pela cotação do dia (via /api/quote).
 * EXCLUSIVO DO SUPER-ADMIN: a cotação automática é uso pessoal do tier free da brapi; os
 * demais usuários ficam manuais (o produto não serve cotação comercial). Roda no unlock,
 * ao focar a aba e a cada mudança de ativos, mas a atualização real é AGENDADA: só em dia
 * de pregão e no máximo 4×/dia (ver isQuoteRefreshDue). Chamadas extras caem na guarda da agenda.
 */
export function useQuotesSync(): void {
  const data = usePatrimonio();
  const { isAdmin } = useIsAdmin();

  useEffect(() => {
    if (!data || !isAdmin) return;
    const run = () => void useQuotes.getState().refresh(data.assets);
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
  }, [data, isAdmin]);
}
