import type Dexie from "dexie";
import type { VaultData } from "./blob";

/**
 * Dump de TODAS as tabelas do Dexie pra um objeto serializável. Genérico: cresce
 * sozinho conforme os módulos da Fase 1 adicionam tabelas.
 */
export async function dumpVault(db: Dexie): Promise<VaultData> {
  const out: VaultData = {};
  for (const t of db.tables) out[t.name] = await t.toArray();
  return out;
}

/** Substitui TODAS as tabelas do Dexie pelo conteúdo do dump (após um PULL). */
export async function loadVault(db: Dexie, data: VaultData): Promise<void> {
  await db.transaction("rw", db.tables, async () => {
    for (const t of db.tables) {
      await t.clear();
      const rows = data[t.name];
      if (Array.isArray(rows) && rows.length > 0) {
        await t.bulkPut(rows);
      }
    }
  });
}
