"use client";

import { createContext, useContext } from "react";
import type { Currency } from "@/types/database";
import type { RateMap } from "@/lib/financial/currency";

type MoneyContextValue = {
  displayCurrency: Currency;
  rates: RateMap;
};

const MoneyContext = createContext<MoneyContextValue | null>(null);

export function MoneyProvider({
  displayCurrency,
  rates,
  children,
}: {
  displayCurrency: Currency;
  rates: RateMap;
  children: React.ReactNode;
}) {
  return (
    <MoneyContext.Provider value={{ displayCurrency, rates }}>{children}</MoneyContext.Provider>
  );
}

export function useMoneyContext(): MoneyContextValue {
  const ctx = useContext(MoneyContext);
  if (!ctx) {
    // Fallback seguro pra evitar crash em ambientes sem provider (testes, isolados).
    return { displayCurrency: "BRL", rates: { "BRL→BRL": 1, "EUR→EUR": 1, "USD→USD": 1 } };
  }
  return ctx;
}

export function useDisplayCurrency(): Currency {
  return useMoneyContext().displayCurrency;
}
