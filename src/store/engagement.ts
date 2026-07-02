import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Estado de ENGAJAMENTO por dispositivo (não é dado financeiro): última visita ao Painel e
 * marcos de independência já comemorados. Persiste em localStorage — só metadados (timestamp +
 * lista de marcos batidos), nenhum valor financeiro em texto claro, então respeita o E2EE.
 */
interface EngagementState {
  /** Timestamp (ms) da última abertura do Painel — pra "bem-vindo de volta / última visita há X". */
  lastVisit: number | null;
  /** Marcos (R$) de independência já celebrados — evita repetir a comemoração. */
  seenMilestones: number[];
  markVisit: () => void;
  markMilestone: (value: number) => void;
}

export const useEngagement = create<EngagementState>()(
  persist(
    (set) => ({
      lastVisit: null,
      seenMilestones: [],
      markVisit: () => set({ lastVisit: Date.now() }),
      markMilestone: (value) =>
        set((s) => (s.seenMilestones.includes(value) ? s : { seenMilestones: [...s.seenMilestones, value] })),
    }),
    { name: "nf-engagement" },
  ),
);
