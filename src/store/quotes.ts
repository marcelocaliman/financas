import { create } from "zustand";
import { persist } from "zustand/middleware";
import { fetchQuotes, isQuotesStale, type Quote } from "@/money/brapi";
import { CURRENCIES, type Currency } from "@/money/currency";
import { actions } from "@/data/actions";
import type { Asset } from "@/domain/types";

interface QuotesState {
  /** Última cotação por ticker (mercado público). */
  prices: Record<string, Quote & { at: number }>;
  updatedAt: number | null;
  status: "idle" | "loading" | "error";
  /**
   * Busca cotações (via /api/quote) dos ativos com ticker e atualiza o valor
   * (amount = quantidade × cotação) só quando muda. `force` ignora o TTL.
   */
  refresh: (assets: Asset[], force?: boolean) => Promise<void>;
}

export const useQuotes = create<QuotesState>()(
  persist(
    (set, get) => ({
      prices: {},
      updatedAt: null,
      status: "idle",
      refresh: async (assets, force) => {
        if (get().status === "loading") return;
        const quotable = assets.filter((a) => a.ticker && (a.quantity ?? 0) > 0);
        if (quotable.length === 0) return;
        // Busca já se algum ticker ainda não tem preço em cache (ativo recém-adicionado),
        // mesmo dentro do TTL — pra a posição nova precificar na hora.
        const missing = quotable.some((a) => !get().prices[(a.ticker ?? "").toUpperCase()]);
        if (!force && !missing && !isQuotesStale(get().updatedAt, Date.now())) return;
        set({ status: "loading" });
        try {
          const quotes = await fetchQuotes(quotable.map((a) => a.ticker));
          const now = Date.now();
          const prices: QuotesState["prices"] = { ...get().prices };
          for (const [k, q] of Object.entries(quotes)) prices[k] = { ...q, at: now };
          set({ prices, updatedAt: now, status: "idle" });
          // Valor = quantidade × cotação, NA MOEDA da cotação (a moeda do ticker é a verdade;
          // corrige a moeda do ativo se divergir). Moeda não suportada → não mexe.
          for (const a of quotable) {
            const q = quotes[(a.ticker ?? "").toUpperCase()];
            if (!q) continue;
            const cur = q.currency.toUpperCase();
            if (!CURRENCIES.includes(cur as Currency)) continue;
            const next = (a.quantity ?? 0) * q.price;
            if (a.currency !== cur || Math.abs(next - a.amount) > 0.005) {
              void actions.putAsset({ ...a, currency: cur as Currency, amount: next });
            }
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
