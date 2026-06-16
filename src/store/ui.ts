import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Currency } from "@/money/currency";

export type Theme = "light" | "dark";

interface UIState {
  /** Moeda em que os valores são exibidos (cada item guarda a sua própria). */
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
      version: 1,
      // Só persistir moeda + tema. numbersHidden volta a TRUE a cada acesso.
      partialize: (s) => ({ displayCurrency: s.displayCurrency, theme: s.theme }),
      // v0→v1: o redesign nasce no ESCURO (força dark p/ quem tinha "claro").
      migrate: (persisted, version) => {
        const s = (persisted ?? {}) as { displayCurrency?: Currency; theme?: Theme };
        return {
          displayCurrency: s.displayCurrency ?? "BRL",
          theme: version < 1 ? "dark" : s.theme ?? "dark",
        };
      },
    },
  ),
);
