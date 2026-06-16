import { create } from "zustand";
import { persist } from "zustand/middleware";
import { fetchQuotes, isQuotesStale, type Quote } from "@/money/brapi";
import { actions } from "@/data/actions";
import type { Asset } from "@/domain/types";

interface QuotesState {
  /** Última cotação por ticker (mercado público). */
  prices: Record<string, Quote & { at: number }>;
  updatedAt: number | null;
  status: "idle" | "loading" | "error";
  /**
   * Busca cotações dos ativos com ticker e atualiza o valor (amount = quantidade ×
   * cotação) só quando muda. `force` ignora o TTL. No-op sem token ou sem tickers.
   */
  refresh: (token: string, assets: Asset[], force?: boolean) => Promise<void>;
}

export const useQuotes = create<QuotesState>()(
  persist(
    (set, get) => ({
      prices: {},
      updatedAt: null,
      status: "idle",
      refresh: async (token, assets, force) => {
        if (get().status === "loading" || !token.trim()) return;
        const quotable = assets.filter((a) => a.ticker && a.quantity != null);
        if (quotable.length === 0) return;
        if (!force && !isQuotesStale(get().updatedAt, Date.now())) return;
        set({ status: "loading" });
        try {
          const quotes = await fetchQuotes(quotable.map((a) => a.ticker), token);
          const now = Date.now();
          const prices: QuotesState["prices"] = {};
          for (const [k, q] of Object.entries(quotes)) prices[k] = { ...q, at: now };
          set({ prices, updatedAt: now, status: "idle" });
          // Valor dos ativos com ticker = quantidade × cotação (só grava se mudou).
          for (const a of quotable) {
            const q = quotes[(a.ticker ?? "").toUpperCase()];
            if (!q) continue;
            const next = (a.quantity ?? 0) * q.price;
            if (Math.abs(next - a.amount) > 0.005) void actions.putAsset({ ...a, amount: next });
          }
        } catch {
          set({ status: "error" });
        }
      },
    }),
    {
      name: "financas-quotes",
      partialize: (s) => ({ prices: s.prices, updatedAt: s.updatedAt }),
    },
  ),
);
