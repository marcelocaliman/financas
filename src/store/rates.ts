import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  CURRENCIES,
  DEFAULT_RATES,
  setLiveRates,
  type Currency,
  type RateTable,
} from "@/money/currency";
import { fetchRates, isStale } from "@/money/rates";

export type RatesSource = "live" | "manual" | "default";

type ManualMap = Partial<Record<Currency, number>>;

/** Taxa efetiva = última automática (base) com os overrides manuais por cima. BRL = 1. */
function effective(base: RateTable, manual: ManualMap): RateTable {
  const out: RateTable = { ...base, BRL: 1 };
  for (const c of CURRENCIES) {
    const m = manual[c];
    if (typeof m === "number" && m > 0) out[c] = m;
  }
  return out;
}

function sourceOf(hasLive: boolean, manual: ManualMap): RatesSource {
  if (Object.keys(manual).length > 0) return "manual";
  return hasLive ? "live" : "default";
}

interface RatesState {
  /** Última cotação automática (ou DEFAULT antes do primeiro fetch). */
  base: RateTable;
  /** Overrides manuais por moeda (fallback do usuário). */
  manual: ManualMap;
  /** Taxa efetiva em uso no app (base + manual). */
  rates: RateTable;
  source: RatesSource;
  updatedAt: number | null;
  hasLive: boolean;
  status: "idle" | "loading" | "error";
  /** Busca a cotação do dia (só se estiver velha, salvo `force`). */
  refresh: (force?: boolean) => Promise<void>;
  setManual: (c: Currency, rate: number) => void;
  clearManual: (c: Currency) => void;
}

export const useRates = create<RatesState>()(
  persist(
    (set, get) => ({
      base: DEFAULT_RATES,
      manual: {},
      rates: DEFAULT_RATES,
      source: "default",
      updatedAt: null,
      hasLive: false,
      status: "idle",

      refresh: async (force) => {
        const { status, updatedAt } = get();
        if (status === "loading") return;
        if (!force && !isStale(updatedAt, Date.now())) return;
        set({ status: "loading" });
        try {
          const base = await fetchRates();
          const { manual } = get();
          const rates = effective(base, manual);
          setLiveRates(rates);
          set({
            base,
            rates,
            hasLive: true,
            updatedAt: Date.now(),
            status: "idle",
            source: sourceOf(true, manual),
          });
        } catch {
          set({ status: "error" });
        }
      },

      setManual: (c, rate) => {
        const manual = { ...get().manual, [c]: rate };
        const rates = effective(get().base, manual);
        setLiveRates(rates);
        set({ manual, rates, source: sourceOf(get().hasLive, manual), updatedAt: Date.now() });
      },

      clearManual: (c) => {
        const manual = { ...get().manual };
        delete manual[c];
        const rates = effective(get().base, manual);
        setLiveRates(rates);
        set({ manual, rates, source: sourceOf(get().hasLive, manual) });
      },
    }),
    {
      name: "financas-rates",
      partialize: (s) => ({
        base: s.base,
        manual: s.manual,
        updatedAt: s.updatedAt,
        hasLive: s.hasLive,
      }),
      // Reconstrói a taxa efetiva do cache e espelha em `convert` antes do primeiro render.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const rates = effective(state.base, state.manual);
        state.rates = rates;
        state.source = sourceOf(state.hasLive, state.manual);
        setLiveRates(rates);
      },
    },
  ),
);
