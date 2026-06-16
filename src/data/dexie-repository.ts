import type { Asset, Expense, Income, Liability, NetWorthSnapshot } from "@/domain/types";
import { TAXONOMY_ID, type Taxonomy } from "@/domain/taxonomy";
import type { DataRepository, SeedData } from "./repository";
import { db, type FinancasDB } from "./db";

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
  listIncomes(): Promise<Income[]> {
    return this.database.incomes.toArray();
  }
  listNetWorthSnapshots(): Promise<NetWorthSnapshot[]> {
    return this.database.netWorthSnapshots.toArray();
  }
}

/** Instância única usada pelo app (a UI só conhece a INTERFACE DataRepository). */
export const repository: DataRepository = new DexieRepository(db);
