import { useLiveQuery } from "dexie-react-hooks";
import { repository } from "@/data/dexie-repository";
import type { Asset, Expense, Income, Liability, NetWorthSnapshot } from "@/domain/types";

export interface DashboardData {
  assets: Asset[];
  liabilities: Liability[];
  expenses: Expense[];
  incomes: Income[];
  snapshots: NetWorthSnapshot[];
}

/**
 * Dados do Painel pela INTERFACE do repositório (não conhece Dexie diretamente).
 * Reativo (useLiveQuery): qualquer mutação local reflete na hora. O app começa
 * VAZIO — sem auto-seed; os dados de exemplo são opt-in na Config.
 */
export function useDashboardData(): { data: DashboardData | null } {
  const data = useLiveQuery(async () => {
    const [assets, liabilities, expenses, incomes, snapshots] = await Promise.all([
      repository.listAssets(),
      repository.listLiabilities(),
      repository.listExpenses(),
      repository.listIncomes(),
      repository.listNetWorthSnapshots(),
    ]);
    return { assets, liabilities, expenses, incomes, snapshots };
  });

  return { data: data ?? null };
}
