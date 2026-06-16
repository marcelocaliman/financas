import { useEffect } from "react";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { useQuotes } from "@/store/quotes";

/**
 * Mantém o valor dos ativos com ticker atualizado pela cotação do dia (via /api/quote —
 * o proxy do servidor já tem o token do dono; o usuário não configura nada). Roda no
 * unlock, ao focar a aba e a cada mudança de ativos; guardado por TTL (6h), então as
 * chamadas extras são baratas. Silencioso quando não há tickers (ou sem token no servidor).
 */
export function useQuotesSync(): void {
  const data = usePatrimonio();

  useEffect(() => {
    if (!data) return;
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
  }, [data]);
}
