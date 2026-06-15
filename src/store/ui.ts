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
}

/** Preferências de UI (persistidas em localStorage). */
export const useUI = create<UIState>()(
  persist(
    (set) => ({
      displayCurrency: "BRL",
      setDisplayCurrency: (displayCurrency) => set({ displayCurrency }),
      theme: "dark",
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
    }),
    { name: "financas-ui" },
  ),
);
