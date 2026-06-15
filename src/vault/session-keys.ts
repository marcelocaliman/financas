import type { VaultKeys } from "@/crypto/envelope";

/**
 * Mantém o cofre DESTRAVADO entre reloads sem pedir a senha de novo. A DEK é um
 * CryptoKey NÃO-exportável; guardamos o próprio CryptoKey no IndexedDB (structured
 * clone preserva a não-exportabilidade — XSS não consegue ler os bytes), preso ao
 * userId. Limpo em "Trancar o cofre"/logout. Não piora o modelo de ameaça: a cópia
 * de trabalho local (Dexie) já fica decifrada no aparelho enquanto destravado.
 */
const DB_NAME = "financas-session";
const STORE = "vk";
const ID = "current";

interface Stored {
  userId: string;
  dek: CryptoKey;
  authTag: Uint8Array;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = op(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export const sessionKeys = {
  async save(userId: string, keys: VaultKeys): Promise<void> {
    try {
      const value: Stored = { userId, dek: keys.dek, authTag: keys.authTag };
      await run("readwrite", (s) => s.put(value, ID));
    } catch {
      /* IndexedDB indisponível — segue (pede senha no reload) */
    }
  },
  async load(userId: string): Promise<VaultKeys | null> {
    try {
      const v = await run<Stored | undefined>("readonly", (s) => s.get(ID));
      if (!v || v.userId !== userId) return null; // sem chave ou de outra conta
      return { dek: v.dek, authTag: v.authTag };
    } catch {
      return null;
    }
  },
  async clear(): Promise<void> {
    try {
      await run("readwrite", (s) => s.delete(ID));
    } catch {
      /* noop */
    }
  },
};
