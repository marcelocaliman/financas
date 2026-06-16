import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Premissas da projeção MULTI-CENÁRIO (planejamento, NÃO saldos). Cada cenário tem o
 * seu retorno e aporte; inicial/inflação/anos são compartilhados. Só os parâmetros
 * persistem; `initialOverride` (saldo customizado) vive SÓ em memória — é um valor e
 * não pode ir pra texto claro. O patrimônio atual entra em runtime.
 */
export type ScenarioKey = "pessimistic" | "base" | "optimistic";
export const SCENARIO_KEYS: ScenarioKey[] = ["pessimistic", "base", "optimistic"];

export interface Scenario {
  annualReturn: number; // % a.a.
  monthly: number;
}

interface ProjectionState {
  scenarios: Record<ScenarioKey, Scenario>;
  annualInflation: number; // % a.a. (compartilhada)
  years: number;
  /** Valor inicial customizado (null = usa o patrimônio atual). Não persiste. */
  initialOverride: number | null;
  setScenario: (key: ScenarioKey, patch: Partial<Scenario>) => void;
  set: (patch: Partial<Pick<ProjectionState, "annualInflation" | "years">>) => void;
  setInitialOverride: (v: number | null) => void;
}

const DEFAULTS: Pick<ProjectionState, "scenarios" | "annualInflation" | "years"> = {
  scenarios: {
    pessimistic: { annualReturn: 5, monthly: 1000 },
    base: { annualReturn: 8, monthly: 1000 },
    optimistic: { annualReturn: 11, monthly: 1000 },
  },
  annualInflation: 4,
  years: 20,
};

export const useProjection = create<ProjectionState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      initialOverride: null,
      setScenario: (key, patch) =>
        set((s) => ({ scenarios: { ...s.scenarios, [key]: { ...s.scenarios[key], ...patch } } })),
      set: (patch) => set(patch),
      setInitialOverride: (initialOverride) => set({ initialOverride }),
    }),
    {
      name: "financas-projection",
      version: 1,
      partialize: (s) => ({
        scenarios: s.scenarios,
        annualInflation: s.annualInflation,
        years: s.years,
      }),
      // v0→v1: o modelo plano (monthly/annualReturn) vira 3 cenários (base = o antigo,
      // otimista/pessimista = base ± 3 p.p.). Mantém anos/inflação.
      migrate: (persisted, version) => {
        const s = (persisted ?? {}) as {
          monthly?: number;
          annualReturn?: number;
          annualInflation?: number;
          years?: number;
          scenarios?: Record<ScenarioKey, Scenario>;
        };
        if (version >= 1 && s.scenarios) {
          return { scenarios: s.scenarios, annualInflation: s.annualInflation ?? 4, years: s.years ?? 20 };
        }
        const monthly = s.monthly ?? 1000;
        const ret = s.annualReturn ?? 8;
        return {
          scenarios: {
            pessimistic: { annualReturn: Math.max(0, ret - 3), monthly },
            base: { annualReturn: ret, monthly },
            optimistic: { annualReturn: ret + 3, monthly },
          },
          annualInflation: s.annualInflation ?? 4,
          years: s.years ?? 20,
        };
      },
    },
  ),
);
