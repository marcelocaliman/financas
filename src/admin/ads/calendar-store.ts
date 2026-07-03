import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Um registro no calendário de divulgação: uma peça (post/story) num dia, planejada ou já postada. */
export interface CalEntry {
  id: string;
  date: string; // AAAA-MM-DD (local)
  pieceId: string; // "post:<id>" | "story:<id>"
  status: "planned" | "posted";
  note?: string;
}

interface CalState {
  entries: CalEntry[];
  add: (e: Omit<CalEntry, "id">) => void;
  update: (id: string, patch: Partial<CalEntry>) => void;
  remove: (id: string) => void;
}

/** Só metadados de divulgação (nada de dado financeiro) → localStorage local do super-admin. */
export const useAdsCalendar = create<CalState>()(
  persist(
    (set) => ({
      entries: [],
      add: (e) =>
        set((s) => ({ entries: [...s.entries, { ...e, id: crypto.randomUUID() }] })),
      update: (id, patch) =>
        set((s) => ({ entries: s.entries.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      remove: (id) => set((s) => ({ entries: s.entries.filter((x) => x.id !== id) })),
    }),
    { name: "nf-ads-calendar" },
  ),
);
