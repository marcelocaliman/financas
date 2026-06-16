import { create } from "zustand";

/** Estado aberto/fechado dos accordions das seções (não persiste). */
interface SectionsState {
  open: Record<string, boolean>;
  setOpen: (id: string, v: boolean) => void;
}

export const useSections = create<SectionsState>((set) => ({
  open: {},
  setOpen: (id, v) => set((s) => ({ open: { ...s.open, [id]: v } })),
}));
