/**
 * Flag persistida: o Dexie local tem mutações que podem NÃO ter chegado ao
 * servidor (push falhou/offline). Enquanto marcada, o unlock NÃO sobrescreve o
 * local com o blob do servidor — sobe primeiro. Garante a durabilidade local-first.
 */
const KEY = "financas-pending-push";

export const pending = {
  set(): void {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* localStorage indisponível — segue sem flag */
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* noop */
    }
  },
  has(): boolean {
    try {
      return localStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  },
};
