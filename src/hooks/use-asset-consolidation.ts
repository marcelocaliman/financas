import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { repository } from "@/data/dexie-repository";
import { actions } from "@/data/actions";

/**
 * Consolidação POR CLASSE × MOEDA — o modelo virou "um valor por classe/moeda", sem discriminar
 * item. Ativos itemizados do modelo antigo (vários papéis na MESMA classe+moeda) são FUNDIDOS num
 * só: soma o valor atual + o valor aplicado e larga nome/subtipo/região/instituição/ticker.
 *
 * Destrutivo por desenho (o usuário pediu "por categoria"), então roda UMA vez e trava — com a
 * flag em DOIS lugares: localStorage (rápido, por device) e settings.migrations no VAULT
 * (sincronizada/cifrada) — um device NOVO que puxa o blob vê a flag do vault e nunca re-funde
 * linhas que o usuário criou de propósito depois da migração. `ran` evita reentrância na sessão
 * (o merge muda os assets → o effect reispararia). Tudo no cliente (E2EE).
 */
const FLAG = "nf-assets-merged-v1";
let ran = false;

export function useAssetConsolidation(): void {
  const assets = useLiveQuery(() => repository.listAssets());
  const settings = useLiveQuery(() => repository.getSettings());
  useEffect(() => {
    if (ran || assets === undefined || settings === undefined) return; // undefined = ainda carregando
    if (settings?.migrations?.assetsMergedV1) {
      // Já rodou em ALGUM device (flag veio do vault) → só espelha localmente e trava.
      try {
        localStorage.setItem(FLAG, "1");
      } catch {
        /* storage indisponível → o guard da sessão (`ran`) segura */
      }
      ran = true;
      return;
    }
    if (localStorage.getItem(FLAG)) {
      ran = true;
      // Legado: rodou aqui antes da flag existir no vault → sobe a flag pra proteger os OUTROS devices.
      void actions.putSettings({ migrations: { ...(settings?.migrations ?? {}), assetsMergedV1: true } });
      return;
    }
    ran = true;
    // Agrupa por classe+subtipo+moeda; funde os grupos com 2+ linhas (não mistura tipos distintos).
    const groups = new Map<string, typeof assets>();
    for (const a of assets) {
      const key = `${a.classId}|${a.subtypeId ?? ""}|${a.currency}`;
      const arr = groups.get(key);
      if (arr) arr.push(a);
      else groups.set(key, [a]);
    }
    void (async () => {
      const round2 = (n: number) => Math.round(n * 100) / 100;
      // "Aplicado" independe da ordem do cost-backfill: usa cost, ou qtd × preço médio dos legados.
      const appliedOf = (a: (typeof assets)[number]) =>
        (a.cost ?? 0) > 0 ? (a.cost as number) : (a.quantity ?? 0) * (a.avgPrice ?? 0);
      for (const arr of groups.values()) {
        if (arr.length < 2) continue; // nada a fundir
        const amount = round2(arr.reduce((s, a) => s + (a.amount ?? 0), 0));
        const cost = round2(arr.reduce((s, a) => s + appliedOf(a), 0));
        const first = arr[0];
        await actions.putAsset({
          id: first.id,
          name: "",
          classId: first.classId,
          ...(first.subtypeId ? { subtypeId: first.subtypeId } : {}),
          currency: first.currency,
          amount,
          ...(cost > 0 ? { cost } : {}),
        });
        for (const a of arr.slice(1)) await actions.removeAsset(a.id);
      }
      // Flags SÓ depois de concluir (aba fechada no meio → próxima sessão completa o merge,
      // que é idempotente: re-fundir os duplicados restantes termina o trabalho).
      await actions.putSettings({ migrations: { ...(settings?.migrations ?? {}), assetsMergedV1: true } });
      try {
        localStorage.setItem(FLAG, "1");
      } catch {
        /* storage indisponível → a flag do vault protege */
      }
    })();
  }, [assets, settings]);
}
