"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type Ctx = {
  open: boolean;
  defaultKind: "expense" | "income" | "transfer";
  show: (kind?: "expense" | "income" | "transfer") => void;
  hide: () => void;
};

const QuickAddCtx = createContext<Ctx | null>(null);

export function QuickAddProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [defaultKind, setDefaultKind] = useState<Ctx["defaultKind"]>("expense");

  const show: Ctx["show"] = useCallback((kind = "expense") => {
    setDefaultKind(kind);
    setOpen(true);
  }, []);

  const hide = useCallback(() => setOpen(false), []);

  // Atalhos globais:
  // - Cmd+Shift+T (mac) / Ctrl+Shift+T → abre quick-add (T = Transação)
  // - Cmd+K → command palette (gerenciado em command-palette.tsx)
  // Também escuta evento customizado pra abrir via palette.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const meta = isMac ? e.metaKey : e.ctrlKey;
      if (meta && e.shiftKey && (e.key === "t" || e.key === "T")) {
        const tag = (document.activeElement as HTMLElement | null)?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select") return;
        e.preventDefault();
        show("expense");
      }
    }
    function quickAddEvent() {
      show("expense");
    }
    window.addEventListener("keydown", handler);
    window.addEventListener("financas:quick-add", quickAddEvent);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("financas:quick-add", quickAddEvent);
    };
  }, [show]);

  return (
    <QuickAddCtx.Provider value={{ open, defaultKind, show, hide }}>
      {children}
    </QuickAddCtx.Provider>
  );
}

export function useQuickAdd() {
  const ctx = useContext(QuickAddCtx);
  if (!ctx) throw new Error("useQuickAdd must be used within QuickAddProvider");
  return ctx;
}
