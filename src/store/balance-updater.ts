import { create } from "zustand";

/** Abre/fecha o drawer "Atualizar saldos" de qualquer lugar (botão do Patrimônio, nudge do Painel).
 *  Estado transitório (não persiste) — só a visibilidade do drawer. */
interface BalanceUpdaterState {
  open: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

export const useBalanceUpdater = create<BalanceUpdaterState>((set) => ({
  open: false,
  openDrawer: () => set({ open: true }),
  closeDrawer: () => set({ open: false }),
}));
