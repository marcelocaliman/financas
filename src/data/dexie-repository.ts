import type {
  AppSettings,
  Asset,
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

  async getSettings(): Promise<AppSettings | null> {
    return (await this.database.settings.get(SETTINGS_ID)) ?? null;
  }
  async putSettings(settings: AppSettings): Promise<void> {
    await this.database.settings.put({ ...settings, id: SETTINGS_ID });
  }
}

/** Instância única usada pelo app (a UI só conhece a INTERFACE DataRepository). */
export const repository: DataRepository = new DexieRepository(db);
