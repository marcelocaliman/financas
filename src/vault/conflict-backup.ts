import { create } from "zustand";

/**
 * Cópia de segurança de CONFLITO de sincronização. Quando dois dispositivos escrevem "ao
 * mesmo tempo", o perdedor da corrida resolve o version_conflict adotando o estado remoto —
 * e o loadVault ZERA as tabelas locais, descartando as mudanças que não subiram. Antes desse
 * descarte, guardamos o dump local aqui (localStorage; o Dexie local já é texto claro no
 * device — mesmo modelo de confiança) no MESMO formato do backup JSON, então a cópia pode
 * ser baixada e até re-importada em Config → Dados. O aviso no Painel sai de useConflictNotice.
 */

const KEY = "nf-conflict-backup";
// localStorage aguenta ~5MB; acima disso, melhor perder a cópia do que quebrar o push.
const MAX_BYTES = 4_000_000;

function readAt(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as { exportedAt?: string }).exportedAt ?? null;
  } catch {
    return null;
  }
}

/** Guarda o dump local pré-merge. Retorna false se não coube/falhou (aviso sai mesmo assim). */
export function saveConflictBackup(data: unknown): boolean {
  try {
    const payload = JSON.stringify({ app: "nossasfinancas", format: 1, exportedAt: new Date().toISOString(), conflict: true, data });
    if (payload.length > MAX_BYTES) return false;
    localStorage.setItem(KEY, payload);
    useConflictNotice.getState().refresh();
    return true;
  } catch {
    return false;
  }
}

/** JSON cru da cópia (pra baixar) — null se não houver. */
export function getConflictBackup(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearConflictBackup(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* sem storage → nada a limpar */
  }
}

/** Estado reativo do aviso (presença da cópia). `dismiss` também APAGA a cópia — o texto do
 *  aviso deixa claro que é pra baixar antes. */
export const useConflictNotice = create<{ at: string | null; refresh: () => void; dismiss: () => void }>((set) => ({
  at: readAt(),
  refresh: () => set({ at: readAt() }),
  dismiss: () => {
    clearConflictBackup();
    set({ at: null });
  },
}));
