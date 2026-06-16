import { useEffect } from "react";
import { useSettings } from "@/hooks/use-settings";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { useQuotes } from "@/store/quotes";

/**
 * Mantém o valor dos ativos com ticker atualizado pela brapi (navegador → brapi
 * direto, com o token cifrado do usuário). Roda no unlock, ao focar a aba e a cada
 * mudança de ativos; o store é guardado por TTL (6h), então as chamadas extras são
 * baratas (no-op quando a cotação ainda está fresca). Silencioso sem token/tickers.
 */
export function useQuotesSync(): void {
  const settings = useSettings();
  const data = usePatrimonio();
  const token = settings.brapiToken?.trim() ?? "";

  useEffect(() => {
    if (!token || !data) return;
    const run = () => void useQuotes.getState().refresh(token, data.assets);
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
  }, [token, data]);
}
