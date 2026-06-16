import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Premissas da projeção (planejamento, NÃO saldos). Só estes parâmetros persistem
 * em localStorage; o valor inicial vem do patrimônio em runtime e nunca é gravado
 * em texto claro (privacidade — saldos só vivem cifrados).
 */
interface ProjectionState {
  monthly: number;
  annualReturn: number; // % a.a.
  annualInflation: number; // % a.a.
  years: number;
  set: (patch: Partial<Omit<ProjectionState, "set">>) => void;
}

export const useProjection = create<ProjectionState>()(
  persist(
    (set) => ({
      monthly: 1000,
      annualReturn: 8,
      annualInflation: 4,
      years: 20,
      set: (patch) => set(patch),
    }),
    { name: "financas-projection" },
  ),
);
