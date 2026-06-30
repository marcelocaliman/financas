import { useCallback, useEffect, useRef } from "react";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { useQuotes } from "@/store/quotes";
import { useCanLiveQuotes } from "@/hooks/use-live-quotes";
import type { Asset } from "@/domain/types";

// Re-checa a cada 10 min enquanto o app fica aberto. O fetch REAL é horário: a guarda
// isQuoteRefreshDue (no store) só deixa buscar 1×/hora, em dia de pregão. O TTL do cache no
// servidor blinda o upstream independente do cliente.
const QUOTE_POLL_MS = 10 * 60 * 1000;

/**
 * Mantém o valor dos ativos com ticker atualizado pela cotação automática (via /api/quote, cache
 * COMPARTILHADO por símbolo). Sincroniza: super-admin sempre (tier free) e assinante do Pro
 * Investidor com a flag 'quotes_live' ON. Dispara no unlock, ao focar a aba, ao reconectar E de
 * HORA EM HORA por um timer próprio — sem ação do usuário. A atualização real é AGENDADA
 * (isQuoteRefreshDue): horária, só no pregão; a guarda + o TTL do servidor blindam o custo.
 *
 * Montado UMA vez na RAIZ (App), pra cobrir todas as telas (inclusive o painel admin).
 */
export function useQuotesSync(): void {
  const data = usePatrimonio();
  const canQuote = useCanLiveQuotes();
  const hasAssets = !!data?.assets?.length;

  // Espelho da lista mais recente + permissão, lido pelos timers/listeners sem recriá-los.
  const latest = useRef<{ assets: Asset[] | undefined; canQuote: boolean }>({ assets: undefined, canQuote: false });
  latest.current = { assets: data?.assets, canQuote };

  const run = useCallback(() => {
    const { assets, canQuote: ok } = latest.current;
    if (ok && assets) void useQuotes.getState().refresh(assets, false);
  }, []);

  // Bootstrap (quando permissão + ativos estão prontos) + foco/reconexão. NÃO reanexa a cada
  // escrita no Dexie (depende de `hasAssets`/`canQuote`, não da identidade do objeto de dados).
  useEffect(() => {
    if (!canQuote || !hasAssets) return;
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
  }, [canQuote, hasAssets, run]);

  // Agenda HORÁRIA — timer ÚNICO enquanto o app fica aberto, imune à frequência de render.
  useEffect(() => {
    const id = window.setInterval(run, QUOTE_POLL_MS);
    return () => window.clearInterval(id);
  }, [run]);
}
