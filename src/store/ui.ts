import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Currency } from "@/money/currency";

export type Theme = "light" | "dark";

interface UIState {
  /** Moeda padrão do usuário: nova entrada nasce nela; é também a visão inicial. */
  baseCurrency: Currency;
  setBaseCurrency: (c: Currency) => void;
  /** Moeda em que os valores são EXIBIDOS (switcher do topo; só converte a visão). */
  displayCurrency: Currency;
  setDisplayCurrency: (c: Currency) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  /** Privacidade: oculta TODOS os valores (••••). VISÍVEL por padrão; toggle opcional. */
  numbersHidden: boolean;
  toggleNumbers: () => void;
  /** Drawer de Configurações aberto (não persiste). */
  configOpen: boolean;
  setConfigOpen: (v: boolean) => void;
}

/** Preferências de UI (displayCurrency + theme persistem; numbersHidden NÃO). */
export const useUI = create<UIState>()(
  persist(
    (set) => ({
      baseCurrency: "BRL",
      // Trocar a moeda padrão também leva a visão pra ela (o topo continua livre depois).
      setBaseCurrency: (baseCurrency) => set({ baseCurrency, displayCurrency: baseCurrency }),
      displayCurrency: "BRL",
      setDisplayCurrency: (displayCurrency) => set({ displayCurrency }),
      theme: "dark",
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
      numbersHidden: false,
      toggleNumbers: () => set((s) => ({ numbersHidden: !s.numbersHidden })),
      configOpen: false,
      setConfigOpen: (configOpen) => set({ configOpen }),
    }),
    {
      name: "financas-ui",
      version: 2,
      // Só persistir moedas + tema. numbersHidden volta a TRUE a cada acesso.
      partialize: (s) => ({
        baseCurrency: s.baseCurrency,
        displayCurrency: s.displayCurrency,
        theme: s.theme,
      }),
      // v0→v1: força dark (o redesign nasce no ESCURO). v1→v2: adiciona baseCurrency,
      // herdada da displayCurrency de quem já usava o app.
      migrate: (persisted, version) => {
        const s = (persisted ?? {}) as {
          baseCurrency?: Currency;
          displayCurrency?: Currency;
          theme?: Theme;
        };
        // Quem já usava o app herda a moeda da visão como sua moeda padrão.
        const baseCurrency = s.baseCurrency ?? s.displayCurrency ?? "BRL";
        return {
          baseCurrency,
          displayCurrency: s.displayCurrency ?? baseCurrency,
          theme: version < 1 ? "dark" : s.theme ?? "dark",
        };
      },
    },
  ),
);
