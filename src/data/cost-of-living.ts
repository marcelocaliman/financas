import type { Currency } from "@/money/currency";

/**
 * Índice de custo de vida APROXIMADO por MOEDA (Real = 100 como referência), pra um
 * comparador simples ("manter o mesmo padrão numa economia de outra moeda custaria X").
 *
 * Por MOEDA, não por país: assim a mesma moeda dá sempre o mesmo valor (Itália, Portugal e
 * Espanha usam o euro → um único índice). EUR é a zona do euro (média aproximada). Valores
 * estáticos arredondados (ordem de grandeza ~ Numbeo, sem aluguel) — não é preço exato.
 */
export interface CurrencyCost {
  currency: Currency;
  /** Custo de vida relativo (Real = 100). Maior = mais caro. */
  index: number;
}

export const CURRENCY_COST: CurrencyCost[] = [
  { currency: "BRL", index: 100 },
  { currency: "EUR", index: 150 },
  { currency: "GBP", index: 170 },
  { currency: "USD", index: 200 },
];

export function currencyCostIndex(currency: Currency): number {
  return CURRENCY_COST.find((c) => c.currency === currency)?.index ?? 100;
}
