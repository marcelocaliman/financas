import { useEffect } from "react";
import { useVault } from "@/vault/vault-store";
import { proApi } from "@/lib/pro-api";
import { useProStore } from "@/store/pro";

/** Carrega o estado Pro do servidor após o unlock. Montar 1× no shell do app.
 *  (Espelha o padrão de carregamento-no-unlock do useIsAdmin.) */
export function useProSync(): void {
  const status = useVault((s) => s.status);
  const resolved = useProStore((s) => s.resolved);
  const setPro = useProStore((s) => s.setPro);
  const resetPro = useProStore((s) => s.resetPro);

  useEffect(() => {
    if (status !== "unlocked") {
      if (resolved) resetPro(); // limpa ao sair/travar (re-checa no próximo unlock)
      return;
    }
    if (resolved) return;
    let alive = true;
    void Promise.all([proApi.isPro(), proApi.getSubscription()])
      .then(([isPro, sub]) => alive && setPro(isPro, sub))
      .catch(() => alive && setPro(false, null)); // falha → trata como free (servidor barra de qualquer jeito)
    return () => {
      alive = false;
    };
  }, [status, resolved, setPro, resetPro]);
}

/** Leitura reativa do estado Pro. */
export function useIsPro(): { isPro: boolean; resolved: boolean } {
  const isPro = useProStore((s) => s.isPro);
  const resolved = useProStore((s) => s.resolved);
  return { isPro, resolved };
}

/** Inicia o teste grátis de 14 dias e atualiza o estado local (sem Stripe). */
export async function startProTrial(): Promise<void> {
  const sub = await proApi.startTrial();
  const isPro = await proApi.isPro();
  useProStore.getState().setPro(isPro, sub);
}

/** Revalida o estado Pro no servidor (poll curto — o webhook pode levar 1-2s pra firmar). */
export async function refreshPro(): Promise<boolean> {
  for (let i = 0; i < 6; i++) {
    try {
      const [isPro, sub] = await Promise.all([proApi.isPro(), proApi.getSubscription()]);
      useProStore.getState().setPro(isPro, sub);
      if (isPro) return true;
    } catch {
      /* ignora; tenta de novo */
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  return false;
}
