import { useEffect, useState } from "react";
import { repository } from "@/data/dexie-repository";
import { SEED } from "@/data/seed";
import type { Asset, Expense, Income, NetWorthSnapshot } from "@/domain/types";

export interface DashboardData {
  assets: Asset[];
  expenses: Expense[];
  incomes: Income[];
  snapshots: NetWorthSnapshot[];
}

/**
 * Carrega os dados do Painel pela INTERFACE do repositório (não conhece Dexie).
 * Semeia dados de exemplo no primeiro acesso. Local-first: instantâneo e offline.
 */
export function useDashboardData(): { data: DashboardData | null } {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (await repository.isEmpty()) await repository.seed(SEED);
      const [assets, expenses, incomes, snapshots] = await Promise.all([
        repository.listAssets(),
        repository.listExpenses(),
        repository.listIncomes(),
        repository.listNetWorthSnapshots(),
      ]);
      if (alive) setData({ assets, expenses, incomes, snapshots });
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { data };
}
