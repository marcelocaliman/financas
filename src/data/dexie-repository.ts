import type {
  AppSettings,
  Asset,
  Dividend,
  Expense,
  Goal,
  Income,
  Liability,
  NetWorthSnapshot,
} from "@/domain/types";
import { TAXONOMY_ID, type Taxonomy } from "@/domain/taxonomy";
import type { DataRepository, SeedData } from "./repository";
import { db, type FinancasDB } from "./db";

const SETTINGS_ID = "settings";

/** Implementação Dexie/IndexedDB da fronteira de persistência (Fase 0a). */
export class DexieRepository implements DataRepository {
  constructor(private readonly database: FinancasDB) {}

  async isEmpty(): Promise<boolean> {
    const [assets, liabilities] = await Promise.all([
      this.database.assets.count(),
      this.database.liabilities.count(),
    ]);
    return assets === 0 && liabilities === 0;
  }

  async seed(data: SeedData): Promise<void> {
    await this.database.transaction("rw", this.database.tables, async () => {
      await this.database.assets.bulkPut(data.assets);
      await this.database.liabilities.bulkPut(data.liabilities);
      await this.database.expenses.bulkPut(data.expenses);
      await this.database.incomes.bulkPut(data.incomes);
      await this.database.netWorthSnapshots.bulkPut(data.snapshots);
      if (data.dividends?.length) await this.database.dividends.bulkPut(data.dividends);
    });
  }

  async clearAll(): Promise<void> {
    await this.database.transaction("rw", this.database.tables, async () => {
      for (const table of this.database.tables) await table.clear();
    });
  }

  listAssets(): Promise<Asset[]> {
    return this.database.assets.toArray();
  }
  async putAsset(asset: Asset): Promise<void> {
    await this.database.assets.put(asset);
  }
  async removeAsset(id: string): Promise<void> {
    await this.database.assets.delete(id);
  }

  listLiabilities(): Promise<Liability[]> {
    return this.database.liabilities.toArray();
  }
  async putLiability(liability: Liability): Promise<void> {
    await this.database.liabilities.put(liability);
  }
  async removeLiability(id: string): Promise<void> {
    await this.database.liabilities.delete(id);
  }

  async getTaxonomy(): Promise<Taxonomy | null> {
    return (await this.database.taxonomy.get(TAXONOMY_ID)) ?? null;
  }
  async putTaxonomy(taxonomy: Taxonomy): Promise<void> {
    await this.database.taxonomy.put({ ...taxonomy, id: TAXONOMY_ID });
  }

  listExpenses(): Promise<Expense[]> {
    return this.database.expenses.toArray();
  }
  async putExpense(expense: Expense): Promise<void> {
    await this.database.expenses.put(expense);
  }
  async removeExpense(id: string): Promise<void> {
    await this.database.expenses.delete(id);
  }

  listIncomes(): Promise<Income[]> {
    return this.database.incomes.toArray();
  }
  async putIncome(income: Income): Promise<void> {
    await this.database.incomes.put(income);
  }
  async removeIncome(id: string): Promise<void> {
    await this.database.incomes.delete(id);
  }

  listNetWorthSnapshots(): Promise<NetWorthSnapshot[]> {
    return this.database.netWorthSnapshots.toArray();
  }
  async putNetWorthSnapshot(snapshot: NetWorthSnapshot): Promise<void> {
    await this.database.netWorthSnapshots.put(snapshot);
  }
  async removeNetWorthSnapshot(id: string): Promise<void> {
    await this.database.netWorthSnapshots.delete(id);
  }

  listGoals(): Promise<Goal[]> {
    return this.database.goals.toArray();
  }
  async putGoal(goal: Goal): Promise<void> {
    await this.database.goals.put(goal);
  }
  async removeGoal(id: string): Promise<void> {
    await this.database.goals.delete(id);
  }

  listDividends(): Promise<Dividend[]> {
    return this.database.dividends.toArray();
  }
  async putDividend(dividend: Dividend): Promise<void> {
    await this.database.dividends.put(dividend);
  }
  async removeDividend(id: string): Promise<void> {
    await this.database.dividends.delete(id);
  }

  async getSettings(): Promise<AppSettings | null> {
    return (await this.database.settings.get(SETTINGS_ID)) ?? null;
  }
  async putSettings(settings: AppSettings): Promise<void> {
    await this.database.settings.put({ ...settings, id: SETTINGS_ID });
  }
}

/** Métodos de ESCRITA — no-op em modo visitante (acesso da família, só-leitura). */
const WRITE_METHODS = new Set([
  "seed", "clearAll", "putAsset", "removeAsset", "putLiability", "removeLiability",
  "putTaxonomy", "putExpense", "removeExpense", "putIncome", "removeIncome",
  "putNetWorthSnapshot", "removeNetWorthSnapshot", "putGoal", "removeGoal",
  "putDividend", "removeDividend", "putSettings",
]);

let READ_ONLY = false;
/** Liga o modo só-leitura: toda escrita do repositório vira no-op (garantia dura do viewer). */
export function setRepositoryReadOnly(v: boolean): void {
  READ_ONLY = v;
}
export function isRepositoryReadOnly(): boolean {
  return READ_ONLY;
}

const base = new DexieRepository(db);

/** Instância única usada pelo app (a UI só conhece a INTERFACE DataRepository). Em modo
 *  visitante, um Proxy intercepta os métodos de escrita e os neutraliza (sem editar cada um). */
export const repository: DataRepository = new Proxy(base, {
  get(target, prop, receiver) {
    const val = Reflect.get(target, prop, receiver);
    if (typeof val !== "function") return val;
    if (READ_ONLY && typeof prop === "string" && WRITE_METHODS.has(prop)) {
      return async () => undefined; // escrita inerte no viewer
    }
    return (val as (...a: unknown[]) => unknown).bind(target);
  },
}) as DataRepository;
