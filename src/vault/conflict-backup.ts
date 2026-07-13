import { create } from "zustand";

/**
 * Cópia de segurança de CONFLITO de sincronização. Quando dois dispositivos escrevem "ao
 * mesmo tempo", o perdedor da corrida resolve o version_conflict adotando o estado remoto —
 * e o loadVault ZERA as tabelas locais, descartando as mudanças que não subiram. Antes desse
 * descarte, guardamos o dump local aqui (localStorage; o Dexie local já é texto claro no
 * device — mesmo modelo de confiança) no MESMO formato do backup JSON, então a cópia pode
 * ser baixada e até re-importada em Config → Dados.
 *
 * INVARIANTE: o AVISO dispara SEMPRE que houver conflito — mesmo quando a cópia não pôde ser
 * salva (storage cheio, erro de serialização). Nesse caso o aviso diz que a cópia não coube,
 * em vez de fingir que nada aconteceu. O estado em memória cobre a sessão atual; um marcador
 * minúsculo (só a data) tenta persistir pra sobreviver a um reload.
 */

const KEY = "nf-conflict-backup";
const KEY_AT = "nf-conflict-at"; // marcador "houve conflito SEM cópia" (poucos bytes)
// localStorage aguenta ~5MB; acima disso, melhor perder a cópia (avisando!) do que quebrar o push.
const MAX_BYTES = 4_000_000;

function readState(): { at: string | null; saved: boolean } {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { at: (JSON.parse(raw) as { exportedAt?: string }).exportedAt ?? null, saved: true };
    const at = localStorage.getItem(KEY_AT);
    if (at) return { at, saved: false };
  } catch {
    /* storage indisponível → sem estado durável (o aviso em memória ainda funciona) */
  }
  return { at: null, saved: false };
}

/** Guarda o dump local pré-merge e SEMPRE aciona o aviso (com ou sem cópia salva). */
export function saveConflictBackup(data: unknown): void {
  const at = new Date().toISOString();
  let saved = false;
  try {
    const payload = JSON.stringify({ app: "nossasfinancas", format: 1, exportedAt: at, conflict: true, data });
    if (payload.length <= MAX_BYTES) {
      localStorage.setItem(KEY, payload);
      saved = true;
    }
  } catch (e) {
    // Diagnóstico (quota × serialização) — sem isso a falha era invisível até pra depurar.
    console.warn("conflict-backup: cópia não salva:", e);
  }
  try {
    if (saved) localStorage.removeItem(KEY_AT);
    else localStorage.setItem(KEY_AT, at); // minúsculo: costuma caber mesmo com quota estourada
  } catch {
    /* nem o marcador coube → resta o aviso em memória da sessão atual */
  }
  // O aviso NUNCA depende do storage: dispara em memória de qualquer jeito.
  useConflictNotice.getState().show(at, saved);
}

/** JSON cru da cópia (pra baixar) — null se não houver. */
export function getConflictBackup(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function clearAll(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(KEY_AT);
  } catch {
    /* sem storage → nada a limpar */
  }
}

/** Estado reativo do aviso. `saved` distingue "cópia baixável" de "conflito sem cópia".
 *  `dismiss` também APAGA a cópia — o texto do aviso deixa claro que é pra baixar antes. */
export const useConflictNotice = create<{
  at: string | null;
  saved: boolean;
  show: (at: string, saved: boolean) => void;
  dismiss: () => void;
}>((set) => ({
  ...readState(),
  show: (at, saved) => set({ at, saved }),
  dismiss: () => {
    clearAll();
    set({ at: null, saved: false });
  },
}));
