import type { Asset, Expense, Income, NetWorthSnapshot } from "@/domain/types";

export interface SeedData {
  assets: Asset[];
  expenses: Expense[];
  incomes: Income[];
  snapshots: NetWorthSnapshot[];
}

/**
 * Fronteira ÚNICA de persistência.
 *
 * Fase 0a (agora): implementada por Dexie/IndexedDB — roda 100% local.
 * Fase 0b (depois): Supabase + E2EE atrás DESTA MESMA interface, sem reescrever
 * os módulos que consomem o repositório.
 *
 * Por enquanto só leitura + seed (suficiente pro shell). CRUD por entidade
 * entra conforme cada módulo (Patrimônio, Orçamento…) for construído.
 */
export interface DataRepository {
  isEmpty(): Promise<boolean>;
  seed(data: SeedData): Promise<void>;
  listAssets(): Promise<Asset[]>;
  listExpenses(): Promise<Expense[]>;
  listIncomes(): Promise<Income[]>;
  listNetWorthSnapshots(): Promise<NetWorthSnapshot[]>;
}
