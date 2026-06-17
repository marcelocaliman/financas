import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Currency } from "@/money/currency";

export type Theme = "light" | "dark";
/** Posição do menu: barra no topo (padrão) ou painel lateral flutuante à esquerda. */
export type NavLayout = "top" | "side";

interface UIState {
  /** Moeda PRINCIPAL do usuário (fonte da verdade): nova entrada nasce nela; é a âncora
   *  de totais e da visão inicial. Configurada pelo usuário. */
  baseCurrency: Currency;
  setBaseCurrency: (c: Currency) => void;
  /** Moeda de EXIBIÇÃO — prévia temporária (switcher do topo). NÃO persiste: a cada
   *  carregamento volta pra principal. Só converte a visão, nunca muda os dados. */
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
  /** Posição do menu (persiste). */
  navLayout: NavLayout;
  setNavLayout: (v: NavLayout) => void;
}

/** Preferências de UI. Persistem só a moeda PRINCIPAL + tema; a exibição é por-sessão. */
export const useUI = create<UIState>()(
  persist(
    (set) => ({
      baseCurrency: "BRL",
      // Trocar a principal leva a visão junto (o switcher do topo continua livre na sessão).
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
      navLayout: "top",
      setNavLayout: (navLayout) => set({ navLayout }),
    }),
    {
      name: "financas-ui",
      version: 3,
      // Persistir a moeda PRINCIPAL + tema + posição do menu. A exibição é por-sessão (sempre
      // nasce na principal) — o switcher do topo é prévia temporária, não um estado salvo.
      partialize: (s) => ({ baseCurrency: s.baseCurrency, theme: s.theme, navLayout: s.navLayout }),
      migrate: (persisted, version) => {
        const s = (persisted ?? {}) as { baseCurrency?: Currency; theme?: Theme; navLayout?: NavLayout };
        // v<3: reseta a moeda principal — a v2 herdava a visão temporária por engano,
        // podendo fixar uma moeda que o usuário nunca escolheu (ex.: euro).
        const baseCurrency = version < 3 ? "BRL" : s.baseCurrency ?? "BRL";
        // v0→v1: o redesign nasce no ESCURO (força dark p/ quem tinha "claro").
        return { baseCurrency, theme: version < 1 ? "dark" : s.theme ?? "dark", navLayout: s.navLayout ?? "top" };
      },
      // A exibição SEMPRE nasce na principal (não persiste) — coerência total no boot.
      onRehydrateStorage: () => (state) => {
        if (state) state.displayCurrency = state.baseCurrency;
      },
    },
  ),
);
