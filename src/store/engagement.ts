import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Estado de ENGAJAMENTO por dispositivo (não é dado financeiro): última visita ao Painel e
 * marcos de independência já comemorados. Persiste em localStorage — só metadados (timestamp +
 * chaves de marcos batidos), nenhum valor financeiro em texto claro, então respeita o E2EE.
 */
interface EngagementState {
  /** Timestamp (ms) da última abertura do Painel — pra "bem-vindo de volta / última visita há X". */
  lastVisit: number | null;
  /** Chaves estáveis dos marcos já contabilizados (evita re-comemorar). */
  seenMilestones: string[];
  /** 1ª rodada já semeada? Sem isto, comemoraríamos marcos batidos ANTES da feature existir. */
  milestonesInitialized: boolean;
  markVisit: () => void;
  /** Semeia os marcos JÁ batidos sem comemorar (só na 1ª vez). */
  initMilestones: (keys: string[]) => void;
  /** Marca marcos como vistos (após comemorar). */
  markMilestones: (keys: string[]) => void;
}

export const useEngagement = create<EngagementState>()(
  persist(
    (set) => ({
      lastVisit: null,
      seenMilestones: [],
      milestonesInitialized: false,
      markVisit: () => set({ lastVisit: Date.now() }),
      initMilestones: (keys) =>
        set((s) => (s.milestonesInitialized ? s : { milestonesInitialized: true, seenMilestones: keys })),
      markMilestones: (keys) =>
        set((s) => ({ seenMilestones: [...new Set([...s.seenMilestones, ...keys])] })),
    }),
    { name: "nf-engagement" },
  ),
);
