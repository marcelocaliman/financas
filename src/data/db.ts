import Dexie, { type Table } from "dexie";
import type { Asset, Expense, Income, NetWorthSnapshot } from "@/domain/types";

/** Banco local (IndexedDB via Dexie). Cópia de trabalho local-first. */
export class FinancasDB extends Dexie {
  assets!: Table<Asset, string>;
  expenses!: Table<Expense, string>;
  incomes!: Table<Income, string>;
  netWorthSnapshots!: Table<NetWorthSnapshot, string>;

  constructor() {
    super("financas");
    this.version(1).stores({
      assets: "id, type, currency",
      expenses: "id, currency",
      incomes: "id, currency",
      netWorthSnapshots: "id, month",
    });
  }
}

export const db = new FinancasDB();
