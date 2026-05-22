"use client";

import { createContext, useContext } from "react";
import type { Currency } from "@/types/database";
import type { RateMap } from "@/lib/financial/currency";

type MoneyContextValue = {
  displayCurrency: Currency;
  /** Moeda mostrada em fonte menor abaixo da principal. null = desligado. */
  comparisonCurrency: Currency | null;
  rates: RateMap;
};

const MoneyContext = createContext<MoneyContextValue | null>(null);

export function MoneyProvider({
  displayCurrency,
  comparisonCurrency,
  rates,
  children,
}: {
  displayCurrency: Currency;
  comparisonCurrency: Currency | null;
  rates: RateMap;
  children: React.ReactNode;
}) {
  return (
    <MoneyContext.Provider value={{ displayCurrency, comparisonCurrency, rates }}>
      {children}
    </MoneyContext.Provider>
  );
}

export function useMoneyContext(): MoneyContextValue {
  const ctx = useContext(MoneyContext);
  if (!ctx) {
    // Fallback seguro pra evitar crash em ambientes sem provider (testes, isolados).
    return {
      displayCurrency: "BRL",
      comparisonCurrency: null,
      rates: { "BRL→BRL": 1, "EUR→EUR": 1, "USD→USD": 1 },
    };
  }
  return ctx;
}

export function useDisplayCurrency(): Currency {
  return useMoneyContext().displayCurrency;
}

export function useComparisonCurrency(): Currency | null {
  return useMoneyContext().comparisonCurrency;
}
