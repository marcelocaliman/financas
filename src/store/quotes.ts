import { create } from "zustand";
import { persist } from "zustand/middleware";
import { fetchQuotes, isQuoteRefreshDue, type Quote } from "@/money/brapi";
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
  refresh: (assets: Asset[], force?: boolean, mode?: "admin" | "live") => Promise<void>;
}

export const useQuotes = create<QuotesState>()(
  persist(
    (set, get) => ({
      prices: {},
      updatedAt: null,
      status: "idle",
      refresh: async (assets, force, mode) => {
        if (get().status === "loading") return;
        const quotable = assets.filter((a) => a.ticker && (a.quantity ?? 0) > 0);
        if (quotable.length === 0) return;
        const prices = get().prices;
        const updatedAt = get().updatedAt;
        // Há ticker SEM cotação ainda (ex.: ativo recém-adicionado)? Busca sem esperar a janela —
        // com throttle de 10min pra não martelar o free tier se um ticker nunca retornar.
        const missing = quotable.some((a) => !prices[(a.ticker ?? "").toUpperCase()]);
        const missingDue = missing && (updatedAt == null || Date.now() - updatedAt > 10 * 60 * 1000);
        // Agenda: dia de pregão; admin ≤4×/dia, live ~15min (ver isQuoteRefreshDue). `force` precifica
        // na hora (incluir/editar ticker), então a posição nova não espera a janela.
        if (!force && !missingDue && !isQuoteRefreshDue(updatedAt, Date.now(), mode)) return;
        set({ status: "loading" });
        try {
          const quotes = await fetchQuotes(quotable.map((a) => a.ticker));
          const now = Date.now();
          // Vazio (fonte caiu, gate, fim de semana) NÃO marca updatedAt — senão a agenda acha que
          // "já atualizou" e trava até a próxima janela. Sem cotação = próxima sincronização re-tenta.
          if (Object.keys(quotes).length === 0) {
            set({ status: "idle" });
            return;
          }
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
