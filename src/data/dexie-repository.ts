import type { Asset, Expense, Income, NetWorthSnapshot } from "@/domain/types";
import type { DataRepository, SeedData } from "./repository";
import { db, type FinancasDB } from "./db";

/** Implementação Dexie/IndexedDB da fronteira de persistência (Fase 0a). */
export class DexieRepository implements DataRepository {
  constructor(private readonly database: FinancasDB) {}

  async isEmpty(): Promise<boolean> {
    return (await this.database.assets.count()) === 0;
  }

  async seed(data: SeedData): Promise<void> {
    await this.database.transaction(
      "rw",
      [
        this.database.assets,
        this.database.expenses,
        this.database.incomes,
        this.database.netWorthSnapshots,
      ],
      async () => {
        await this.database.assets.bulkPut(data.assets);
        await this.database.expenses.bulkPut(data.expenses);
        await this.database.incomes.bulkPut(data.incomes);
        await this.database.netWorthSnapshots.bulkPut(data.snapshots);
      },
    );
  }

  listAssets(): Promise<Asset[]> {
    return this.database.assets.toArray();
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
