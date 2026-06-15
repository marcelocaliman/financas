import Dexie, { type Table } from "dexie";
import type { Asset, Expense, Income, Liability, NetWorthSnapshot } from "@/domain/types";

/** Banco local (IndexedDB via Dexie). Cópia de trabalho local-first. */
export class FinancasDB extends Dexie {
  assets!: Table<Asset, string>;
  liabilities!: Table<Liability, string>;
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
    // v2: passivos (Patrimônio). Tabelas da v1 são preservadas.
    this.version(2).stores({
      liabilities: "id, type, currency",
    });
  }
}

export const db = new FinancasDB();
