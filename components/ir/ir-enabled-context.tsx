"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Disponibiliza pros client components se o IRPF está ligado pro household
 * (households.ir_enabled). Valor computado no server (layout) e injetado aqui,
 * pra os formulários esconderem os campos de IR sem precisar passar prop por
 * toda a árvore. Default true (não esconde nada se o provider faltar).
 */
const IrEnabledContext = createContext<boolean>(true);

export function IrEnabledProvider({
  value,
  children,
}: {
  value: boolean;
  children: ReactNode;
}) {
  return <IrEnabledContext.Provider value={value}>{children}</IrEnabledContext.Provider>;
}

export function useIrEnabled(): boolean {
  return useContext(IrEnabledContext);
}
