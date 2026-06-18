import { create } from "zustand";

/** Estado do painel super-admin, espelhado na URL no path /app/admin — assim o painel
 *  tem URL própria e profissional: bookmarkável, recarregável (refresh mantém no painel)
 *  e com voltar/avançar do navegador. O rewrite da Vercel (/app/(.*) → /app.html) e o
 *  navigateFallback do SW (allowlist /app*) garantem que /app/admin sirva o app. */
interface AdminUIState {
  adminOpen: boolean;
  setAdminOpen: (v: boolean) => void;
  /** Recalcula a partir do path atual (para popstate). */
  syncFromPath: () => void;
}

const ADMIN_PATH = "/app/admin";
const APP_PATH = "/app";

function isAdminPath(): boolean {
  return typeof location !== "undefined" && location.pathname.replace(/\/+$/, "") === ADMIN_PATH;
}

function pushUrl(open: boolean) {
  try {
    if (typeof location === "undefined" || typeof history === "undefined") return;
    const onAdmin = isAdminPath();
    if (open && !onAdmin) {
      history.pushState(null, "", ADMIN_PATH + location.search + location.hash);
    } else if (!open && onAdmin) {
      history.pushState(null, "", APP_PATH + location.search + location.hash);
    }
  } catch {
    /* ignore */
  }
}

export const useAdminUI = create<AdminUIState>((set) => ({
  adminOpen: isAdminPath(),
  setAdminOpen: (adminOpen) => {
    pushUrl(adminOpen);
    set({ adminOpen });
  },
  syncFromPath: () => set({ adminOpen: isAdminPath() }),
}));
