import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isStale } from "@/money/rates";
import { SPOT_ASSETS, QUOTE, fetchSpot, type SpotAsset } from "@/money/spot";

type PriceMap = Partial<Record<SpotAsset, number>>;

/** AAAA-MM-DD de N dias atrás — fechamento anterior p/ a variação do dia. */
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Cotação de ouro (XAU/oz) e bitcoin (BTC) pro ticker — de hoje + do fechamento anterior (variação
 * do dia), SEMPRE em DÓLAR (QUOTE). Persistido + TTL de 12h (mesmo ritmo do câmbio). Só dado público
 * — fora do E2EE. Como a moeda é fixa (USD), não refaz ao trocar a moeda principal do usuário.
 */
interface SpotState {
  prices: PriceMap;
  prevPrices: PriceMap;
  updatedAt: number | null;
  status: "idle" | "loading" | "error";
  refresh: (force?: boolean) => Promise<void>;
}

export const useSpot = create<SpotState>()(
  persist(
    (set, get) => ({
      prices: {},
      prevPrices: {},
      updatedAt: null,
      status: "idle",
      refresh: async (force) => {
        const { status, updatedAt, prices: oldPrices, prevPrices: oldPrev } = get();
        if (status === "loading") return;
        if (!force && !isStale(updatedAt, Date.now())) return;
        set({ status: "loading" });
        const yesterday = daysAgo(1);
        try {
          const results = await Promise.all(
            SPOT_ASSETS.map(async (a) => {
              const [today, prev] = await Promise.all([
                fetchSpot(a, QUOTE).catch(() => null),
                fetchSpot(a, QUOTE, yesterday).catch(() => null),
              ]);
              return { a, today, prev };
            }),
          );
          // Se NADA fresco veio (rede/API fora), mantém o cache e NÃO renova o TTL (retenta antes).
          if (!results.some((r) => r.today != null)) {
            set({ status: "error" });
            return;
          }
          // Parte do cache e só sobrescreve o que veio fresco — falha de UM ativo não apaga o outro.
          const prices: PriceMap = { ...oldPrices };
          const prevPrices: PriceMap = { ...oldPrev };
          for (const { a, today, prev } of results) {
            if (today != null) prices[a] = today;
            if (prev != null) prevPrices[a] = prev;
          }
          set({ prices, prevPrices, updatedAt: Date.now(), status: "idle" });
        } catch {
          set({ status: "error" });
        }
      },
    }),
    {
      name: "financas-spot",
      partialize: (s) => ({ prices: s.prices, prevPrices: s.prevPrices, updatedAt: s.updatedAt }),
    },
  ),
);
