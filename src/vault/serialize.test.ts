import { describe, it, expect } from "vitest";
import type Dexie from "dexie";
import { loadVault } from "./serialize";
import type { VaultData } from "./blob";

/** Dexie falso (sem IndexedDB): registra clears e guarda linhas por tabela. */
function fakeDb() {
  const data: Record<string, unknown[]> = {
    assets: [],
    liabilities: [],
    expenses: [],
    incomes: [],
    netWorthSnapshots: [],
  };
  const cleared: string[] = [];
  const tables = Object.keys(data).map((name) => ({
    name,
    async clear() {
      cleared.push(name);
      data[name] = [];
    },
    async bulkPut(rows: unknown[]) {
      data[name] = [...rows];
    },
  }));
  const db = {
    tables,
    async transaction(_mode: string, _tables: unknown, fn: () => Promise<void>) {
      await fn();
    },
  } as unknown as Dexie;
  return { db, data, cleared };
}

describe("loadVault — compatibilidade com blob antigo", () => {
  it("restaura tabelas presentes e ZERA as ausentes (blob v1 sem 'liabilities')", async () => {
    const { db, data, cleared } = fakeDb();
    data.liabilities = [{ id: "antigo" }]; // resíduo local a ser apagado

    const v1blob: VaultData = {
      assets: [{ id: "a1", name: "Tesouro", classId: "renda-fixa", currency: "BRL", amount: 10 }],
      expenses: [{ id: "e1", name: "Moradia", currency: "EUR", amount: 5 }],
      // sem 'liabilities' / 'incomes' / 'netWorthSnapshots' (formato pré-v2)
    };

    await loadVault(db, v1blob);

    expect(data.assets).toHaveLength(1);
    expect(data.expenses).toHaveLength(1);
    expect(data.liabilities).toEqual([]); // ausente no blob → limpa, não ressuscita
    expect(data.incomes).toEqual([]);
    expect(cleared).toContain("liabilities");
  });
});
