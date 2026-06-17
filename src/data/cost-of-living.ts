import type { Currency } from "@/money/currency";

/**
 * Índice de custo de vida APROXIMADO por país (Brasil = 100 como referência), pra um
 * comparador simples ("manter o mesmo padrão custaria X em outro país"). Valores
 * estáticos e arredondados (ordem de grandeza ~ Numbeo, sem aluguel) — não é precisão;
 * o usuário confirma. `key` casa com a tradução em crossborder.country.<key>.
 * `currency` é a moeda LOCAL do país — o equivalente é mostrado nela (R$→€ etc.).
 */
export interface CountryCost {
  key: string;
  flag: string;
  /** Custo de vida relativo (Brasil = 100). Maior = mais caro. */
  index: number;
  /** Moeda local (pra exibir o equivalente na moeda do país). */
  currency: Currency;
}

export const COST_OF_LIVING: CountryCost[] = [
  { key: "br", flag: "🇧🇷", index: 100, currency: "BRL" },
  { key: "pt", flag: "🇵🇹", index: 135, currency: "EUR" },
  { key: "it", flag: "🇮🇹", index: 155, currency: "EUR" },
  { key: "es", flag: "🇪🇸", index: 140, currency: "EUR" },
  { key: "fr", flag: "🇫🇷", index: 170, currency: "EUR" },
  { key: "de", flag: "🇩🇪", index: 165, currency: "EUR" },
  { key: "uk", flag: "🇬🇧", index: 170, currency: "GBP" },
  { key: "us", flag: "🇺🇸", index: 200, currency: "USD" },
  { key: "ch", flag: "🇨🇭", index: 270, currency: "EUR" },
];

export function countryCost(key: string): CountryCost | undefined {
  return COST_OF_LIVING.find((c) => c.key === key);
}
