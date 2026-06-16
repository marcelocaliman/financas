import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Premissas da projeção (planejamento, NÃO saldos). Só os parâmetros persistem em
 * localStorage; `initialOverride` (valor inicial customizado) vive SÓ em memória —
 * é um saldo e não pode ir pra texto claro. O patrimônio atual entra em runtime.
 */
interface ProjectionState {
  monthly: number;
  annualReturn: number; // % a.a.
  annualInflation: number; // % a.a.
  years: number;
  /** Valor inicial customizado (null = usa o patrimônio atual). Não persiste. */
  initialOverride: number | null;
  set: (patch: Partial<Pick<ProjectionState, "monthly" | "annualReturn" | "annualInflation" | "years">>) => void;
  setInitialOverride: (v: number | null) => void;
}

export const useProjection = create<ProjectionState>()(
  persist(
    (set) => ({
      monthly: 1000,
      annualReturn: 8,
      annualInflation: 4,
      years: 20,
      initialOverride: null,
      set: (patch) => set(patch),
      setInitialOverride: (initialOverride) => set({ initialOverride }),
    }),
    {
      name: "financas-projection",
      partialize: (s) => ({
        monthly: s.monthly,
        annualReturn: s.annualReturn,
        annualInflation: s.annualInflation,
        years: s.years,
      }),
    },
  ),
);
