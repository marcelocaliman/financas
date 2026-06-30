import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RateTable } from "@/money/currency";
import { fetchRatesSeries, isStale } from "@/money/rates";

/**
 * Câmbio de HOJE + do fechamento ANTERIOR (taxas de referência públicas do Frankfurter), pra
 * calcular a variação do dia — do patrimônio (linha do painel) e par-a-par (card de moedas).
 * Persistido + TTL de 12h: atualiza ~1×/dia; no fim de semana mantém o último par de pregões.
 */
interface FxHistoryState {
  today: RateTable | null;
  todayDate: string | null;
  prev: RateTable | null;
  prevDate: string | null;
  updatedAt: number | null;
  status: "idle" | "loading" | "error";
  refresh: (force?: boolean) => Promise<void>;
}

export const useFxHistory = create<FxHistoryState>()(
  persist(
    (set, get) => ({
      today: null,
      todayDate: null,
      prev: null,
      prevDate: null,
      updatedAt: null,
      status: "idle",
      refresh: async (force) => {
        const { status, updatedAt } = get();
        if (status === "loading") return;
        if (!force && !isStale(updatedAt, Date.now())) return;
        set({ status: "loading" });
        try {
          const series = await fetchRatesSeries(8);
          if (series.length === 0) {
            set({ status: "idle" });
            return;
          }
          const last = series[series.length - 1];
          const prior = series.length >= 2 ? series[series.length - 2] : null;
          set({
            today: last.rates,
            todayDate: last.date,
            prev: prior ? prior.rates : get().prev,
            prevDate: prior ? prior.date : get().prevDate,
            updatedAt: Date.now(),
            status: "idle",
          });
        } catch {
          set({ status: "error" });
        }
      },
    }),
    {
      name: "financas-fx-history",
      partialize: (s) => ({
        today: s.today,
        todayDate: s.todayDate,
        prev: s.prev,
        prevDate: s.prevDate,
        updatedAt: s.updatedAt,
      }),
    },
  ),
);
