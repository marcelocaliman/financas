import { create } from "zustand";

/** Estado aberto/fechado dos accordions das seções (não persiste). */
interface SectionsState {
  open: Record<string, boolean>;
  setOpen: (id: string, v: boolean) => void;
  /** Define o estado de vários ids de uma vez (abrir/fechar tudo). */
  setMany: (ids: string[], v: boolean) => void;
}

export const useSections = create<SectionsState>((set) => ({
  open: {},
  setOpen: (id, v) => set((s) => ({ open: { ...s.open, [id]: v } })),
  setMany: (ids, v) =>
    set((s) => ({ open: { ...s.open, ...Object.fromEntries(ids.map((id) => [id, v])) } })),
}));
