import type {
  AppSettings,
  Asset,
  Dividend,
  Expense,
  Goal,
  Income,
  Liability,
  NetWorthSnapshot,
  Subscription,
} from "@/domain/types";
import type { TaxReturn, TaxItem } from "@/domain/irpf";
import type { Taxonomy } from "@/domain/taxonomy";

export interface SeedData {
  assets: Asset[];
  liabilities: Liability[];
  expenses: Expense[];
  incomes: Income[];
  snapshots: NetWorthSnapshot[];
  dividends?: Dividend[];
  /** Metas (Objetivos) — opcional; o exemplo já traz um conjunto coerente. */
  goals?: Goal[];
  /** Assinaturas recorrentes (documentação) — opcional. */
  subscriptions?: Subscription[];
  /** Organizador de IRPF (retrato de exemplo/vitrine) — opcional. */
  taxReturns?: TaxReturn[];
  taxItems?: TaxItem[];
  /** Preferências sincronizadas do exemplo (alvos de alocação, config da Liberdade/Saúde).
   *  A moeda principal NÃO vem aqui — é injetada por quem carrega (loadSample). */
  settings?: Pick<AppSettings, "allocationTargets" | "liberdade" | "health">;
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

  // Patrimônio — listAssets = só ATIVOS (não vendidos); listAllAssets inclui os vendidos (IRPF/backup).
  listAssets(): Promise<Asset[]>;
  listAllAssets(): Promise<Asset[]>;
  putAsset(asset: Asset): Promise<void>;
  removeAsset(id: string): Promise<void>;
  listLiabilities(): Promise<Liability[]>;
  putLiability(liability: Liability): Promise<void>;
  removeLiability(id: string): Promise<void>;

  // Taxonomia editável (Classes, Subtipos, Regiões, Indexadores, Tipos de passivo)
  getTaxonomy(): Promise<Taxonomy | null>;
  putTaxonomy(taxonomy: Taxonomy): Promise<void>;

  // Orçamento
  listExpenses(): Promise<Expense[]>;
  putExpense(expense: Expense): Promise<void>;
  removeExpense(id: string): Promise<void>;
  listIncomes(): Promise<Income[]>;
  putIncome(income: Income): Promise<void>;
  removeIncome(id: string): Promise<void>;

  // Histórico
  listNetWorthSnapshots(): Promise<NetWorthSnapshot[]>;
  putNetWorthSnapshot(snapshot: NetWorthSnapshot): Promise<void>;
  removeNetWorthSnapshot(id: string): Promise<void>;

  // Objetivos
  listGoals(): Promise<Goal[]>;
  putGoal(goal: Goal): Promise<void>;
  removeGoal(id: string): Promise<void>;

  // Proventos / dividendos
  listDividends(): Promise<Dividend[]>;
  putDividend(dividend: Dividend): Promise<void>;
  removeDividend(id: string): Promise<void>;

  // Assinaturas recorrentes (documentação)
  listSubscriptions(): Promise<Subscription[]>;
  putSubscription(subscription: Subscription): Promise<void>;
  removeSubscription(id: string): Promise<void>;

  // Organizador de IRPF (snapshot anual: cabeçalho por ano + posições de 31/12)
  listTaxReturns(): Promise<TaxReturn[]>;
  getTaxReturn(id: string): Promise<TaxReturn | null>;
  putTaxReturn(taxReturn: TaxReturn): Promise<void>;
  removeTaxReturn(id: string): Promise<void>;
  listTaxItems(baseYear: number): Promise<TaxItem[]>;
  putTaxItem(item: TaxItem): Promise<void>;
  putTaxItems(items: TaxItem[]): Promise<void>;
  removeTaxItem(id: string): Promise<void>;

  // Configurações sincronizadas (alvos de alocação, etc.)
  getSettings(): Promise<AppSettings | null>;
  putSettings(settings: AppSettings): Promise<void>;
}
