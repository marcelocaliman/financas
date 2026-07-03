import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Currency } from "@/money/currency";
import { isStale } from "@/money/rates";
import { SPOT_ASSETS, fetchSpot, type SpotAsset } from "@/money/spot";

type PriceMap = Partial<Record<SpotAsset, number>>;

/** AAAA-MM-DD de N dias atrás — fechamento anterior p/ a variação do dia. */
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Cotação de ouro (XAU/oz) e bitcoin (BTC) pro ticker — de hoje + do fechamento anterior (variação
 * do dia), JÁ na moeda principal do usuário. Persistido + TTL de 12h (mesmo ritmo do câmbio). Refaz
 * quando a moeda muda (o preço é por-moeda) ou quando envelhece. Só dado público — fora do E2EE.
 */
interface SpotState {
  base: Currency | null; // moeda em que `prices`/`prevPrices` estão expressos
  prices: PriceMap;
  prevPrices: PriceMap;
  updatedAt: number | null;
  status: "idle" | "loading" | "error";
  refresh: (base: Currency, force?: boolean) => Promise<void>;
}

export const useSpot = create<SpotState>()(
  persist(
    (set, get) => ({
      base: null,
      prices: {},
      prevPrices: {},
      updatedAt: null,
      status: "idle",
      refresh: async (base, force) => {
        const { status, updatedAt, base: prevBase, prices: oldPrices, prevPrices: oldPrev } = get();
        if (status === "loading") return;
        // Refaz se trocou a moeda (preços são por-moeda) OU se passou o TTL de 12h.
        if (!force && base === prevBase && !isStale(updatedAt, Date.now())) return;
        set({ status: "loading" });
        const yesterday = daysAgo(1);
        // Mesma moeda → parte do cache e só sobrescreve o que vier fresco (falha de UM ativo não
        // apaga o outro). Trocou a moeda → começa limpo (não misturar preço da moeda antiga).
        const sameBase = base === prevBase;
        try {
          const results = await Promise.all(
            SPOT_ASSETS.map(async (a) => {
              const [today, prev] = await Promise.all([
                fetchSpot(a, base).catch(() => null),
                fetchSpot(a, base, yesterday).catch(() => null),
              ]);
              return { a, today, prev };
            }),
          );
          // Se NADA fresco veio (rede/API fora), mantém o cache e NÃO renova o TTL (retenta antes).
          if (!results.some((r) => r.today != null)) {
            set({ status: "error" });
            return;
          }
          const prices: PriceMap = sameBase ? { ...oldPrices } : {};
          const prevPrices: PriceMap = sameBase ? { ...oldPrev } : {};
          for (const { a, today, prev } of results) {
            if (today != null) prices[a] = today;
            if (prev != null) prevPrices[a] = prev;
          }
          set({ base, prices, prevPrices, updatedAt: Date.now(), status: "idle" });
        } catch {
          set({ status: "error" });
        }
      },
    }),
    {
      name: "financas-spot",
      partialize: (s) => ({ base: s.base, prices: s.prices, prevPrices: s.prevPrices, updatedAt: s.updatedAt }),
    },
  ),
);
