import { create } from "zustand";

/** Estado do painel super-admin (não persiste — abre via menu do usuário admin). */
interface AdminUIState {
  adminOpen: boolean;
  setAdminOpen: (v: boolean) => void;
}

export const useAdminUI = create<AdminUIState>((set) => ({
  adminOpen: false,
  setAdminOpen: (adminOpen) => set({ adminOpen }),
}));
