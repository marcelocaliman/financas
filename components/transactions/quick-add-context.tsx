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

  // Atalho global: Cmd+N (mac) / Ctrl+N (outros) abre o modal.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const meta = isMac ? e.metaKey : e.ctrlKey;
      if (meta && (e.key === "n" || e.key === "N") && !e.shiftKey && !e.altKey) {
        const tag = (document.activeElement as HTMLElement | null)?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select") return;
        e.preventDefault();
        show("expense");
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
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
