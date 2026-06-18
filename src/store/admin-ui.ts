import { create } from "zustand";

/** Estado do painel super-admin, espelhado na URL via hash (#admin) — assim o painel
 *  tem URL própria: bookmarkável, recarregável e com botão "voltar" do navegador. Usamos
 *  hash (não um path) de propósito: a navegação continua sendo pra /app (que o SW/rewrite
 *  já servem), evitando o fallback de navegação do service worker servir a landing. */
interface AdminUIState {
  adminOpen: boolean;
  setAdminOpen: (v: boolean) => void;
  /** Recalcula a partir do hash atual (para hashchange/popstate). */
  syncFromHash: () => void;
}

const HASH = "admin";

function hashIsAdmin(): boolean {
  return typeof location !== "undefined" && location.hash.replace(/^#/, "").toLowerCase() === HASH;
}

function pushUrl(open: boolean) {
  try {
    if (typeof location === "undefined" || typeof history === "undefined") return;
    const onAdmin = hashIsAdmin();
    if (open && !onAdmin) {
      history.pushState(null, "", location.pathname + location.search + "#" + HASH);
    } else if (!open && onAdmin) {
      history.pushState(null, "", location.pathname + location.search);
    }
  } catch {
    /* ignore */
  }
}

export const useAdminUI = create<AdminUIState>((set) => ({
  adminOpen: hashIsAdmin(),
  setAdminOpen: (adminOpen) => {
    pushUrl(adminOpen);
    set({ adminOpen });
  },
  syncFromHash: () => set({ adminOpen: hashIsAdmin() }),
}));
