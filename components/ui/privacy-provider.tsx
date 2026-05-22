"use client";

import { createContext, useContext, useState, useSyncExternalStore } from "react";

type PrivacyContextValue = {
  hidden: boolean;
  toggle: () => void;
};

const PrivacyContext = createContext<PrivacyContextValue>({
  hidden: false,
  toggle: () => {},
});

const STORAGE_KEY = "financas:hideValues";

function readStored(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  // SSR-safe: começa false; o useSyncExternalStore só lê localStorage no client,
  // sem precisar de useEffect + setState (que o lint do React 19 reprova).
  const storedHidden = useSyncExternalStore(
    subscribe,
    readStored,
    () => false,
  );
  // Permite override local (toggle no botão) sem depender de evento storage.
  const [override, setOverride] = useState<boolean | null>(null);
  const hidden = override ?? storedHidden;

  const toggle = () => {
    const next = !hidden;
    setOverride(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {}
  };

  return (
    <PrivacyContext.Provider value={{ hidden, toggle }}>{children}</PrivacyContext.Provider>
  );
}

export function usePrivacy(): PrivacyContextValue {
  return useContext(PrivacyContext);
}

/**
 * Substitui dígitos por bullets. Mantém moeda, sinais, separadores e letras.
 * Funciona com qualquer string de moeda formatada (R$ 1.234,56 → R$ •.•••,••).
 */
export function maskMoneyString(s: string): string {
  return s.replace(/\d/g, "•");
}

/**
 * Wrapper minúsculo: mascara dígitos do conteúdo quando o privacy está ligado.
 * Use ao redor de strings já formatadas via `formatMoney`, `toFixed`, etc.
 *
 * Funciona em server tree (componente client pode ser filho de server) e em
 * client tree. Aceita string, number, ou um array deles (JSX gera array
 * quando você intercala texto literal, ex: `{integer},{cents}`).
 */
type MoneyMaskInput = string | number | null | undefined;
export function MoneyMask({
  children,
}: {
  children: MoneyMaskInput | MoneyMaskInput[];
}) {
  const { hidden } = usePrivacy();
  const arr = Array.isArray(children) ? children : [children];
  const s = arr
    .filter((x) => x != null)
    .map((x) => String(x))
    .join("");
  if (s.length === 0) return null;
  return <>{hidden ? maskMoneyString(s) : s}</>;
}
