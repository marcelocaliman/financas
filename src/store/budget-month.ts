import { create } from "zustand";

/** Mês corrente "AAAA-MM" (fuso local). */
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Mês selecionado do Orçamento — COMPARTILHADO entre a página e o cabeçalho (KPIs do
 * accordion), pra os dois mostrarem o mesmo mês. Não persiste: cada sessão começa no mês
 * atual. (Antes era estado local da página, então o header não acompanhava o seletor.)
 */
interface BudgetMonthState {
  month: string;
  setMonth: (m: string) => void;
}

export const useBudgetMonth = create<BudgetMonthState>((set) => ({
  month: currentMonth(),
  setMonth: (month) => set({ month }),
}));
