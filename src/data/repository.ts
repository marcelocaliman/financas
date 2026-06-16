import type { Asset, Expense, Income, Liability, NetWorthSnapshot } from "@/domain/types";
import type { Taxonomy } from "@/domain/taxonomy";

export interface SeedData {
  assets: Asset[];
  liabilities: Liability[];
  expenses: Expense[];
  incomes: Income[];
  snapshots: NetWorthSnapshot[];
}

/**
 * Fronteira ÚNICA de persistência.
 *
 * Fase 0a (agora): implementada por Dexie/IndexedDB — roda 100% local.
 * Fase 0b (feito): Supabase + E2EE sincronizam o blob cifrado por cima DESTA
 * mesma interface, sem reescrever os módulos que a consomem.
 *
 * CRUD por entidade entra conforme cada módulo (Patrimônio, Orçamento…) é construído.
 */
export interface DataRepository {
  isEmpty(): Promise<boolean>;
  seed(data: SeedData): Promise<void>;
  clearAll(): Promise<void>;

  // Patrimônio
  listAssets(): Promise<Asset[]>;
  putAsset(asset: Asset): Promise<void>;
  removeAsset(id: string): Promise<void>;
  listLiabilities(): Promise<Liability[]>;
  putLiability(liability: Liability): Promise<void>;
  removeLiability(id: string): Promise<void>;

  // Taxonomia editável (Classes, Subtipos, Regiões, Indexadores, Tipos de passivo)
  getTaxonomy(): Promise<Taxonomy | null>;
  putTaxonomy(taxonomy: Taxonomy): Promise<void>;

  // Orçamento / Histórico (leitura por enquanto)
  listExpenses(): Promise<Expense[]>;
  listIncomes(): Promise<Income[]>;
  listNetWorthSnapshots(): Promise<NetWorthSnapshot[]>;
}
