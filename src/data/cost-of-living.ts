/**
 * Índice de custo de vida APROXIMADO por país (Brasil = 100 como referência), pra um
 * comparador simples ("manter o mesmo padrão custaria X em outro país"). Valores
 * estáticos e arredondados — direção de grandeza, não precisão; o usuário confirma.
 * `key` casa com a tradução em crossborder.country.<key>.
 */
export interface CountryCost {
  key: string;
  flag: string;
  /** Custo de vida relativo (Brasil = 100). Maior = mais caro. */
  index: number;
}

export const COST_OF_LIVING: CountryCost[] = [
  { key: "br", flag: "🇧🇷", index: 100 },
  { key: "pt", flag: "🇵🇹", index: 165 },
  { key: "it", flag: "🇮🇹", index: 200 },
  { key: "es", flag: "🇪🇸", index: 185 },
  { key: "fr", flag: "🇫🇷", index: 230 },
  { key: "de", flag: "🇩🇪", index: 235 },
  { key: "uk", flag: "🇬🇧", index: 250 },
  { key: "us", flag: "🇺🇸", index: 270 },
  { key: "ch", flag: "🇨🇭", index: 380 },
];

export function countryCost(key: string): CountryCost | undefined {
  return COST_OF_LIVING.find((c) => c.key === key);
}
