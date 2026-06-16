import { convert, CURRENCIES, getLiveRates, type Currency, type RateTable } from "./currency";

/**
 * Cor de cada moeda — alinhada aos selos luminosos (chip-*) por tema, pra a
 * fatia da aurora e o gráfico baterem com o chip da mesma moeda.
 */
const CUR_COLOR_DARK: Record<Currency, string> = {
  BRL: "#3ECF8E",
  EUR: "#8A8F98",
  USD: "#A6ACB5",
  GBP: "#6B7280",
};
const CUR_COLOR_LIGHT: Record<Currency, string> = {
  BRL: "#15976A",
  EUR: "#6B7280",
  USD: "#878E98",
  GBP: "#52525B",
};

export function currencyColors(theme: "light" | "dark"): Record<Currency, string> {
  return theme === "dark" ? CUR_COLOR_DARK : CUR_COLOR_LIGHT;
}

export interface CurrencySlice {
  currency: Currency;
  value: number; // já convertido pra moeda de exibição
  pct: number; // inteiro; as fatias somam exatamente 100
}

/**
 * Quebra por moeda (valores convertidos pra moeda de exibição), com percentuais
 * inteiros que fecham em 100 via maior-resto (evita 99%/101% na barra empilhada).
 */
export function currencyBreakdown(
  items: { amount: number; currency: Currency }[],
  display: Currency,
  rates: RateTable = getLiveRates(),
): CurrencySlice[] {
  const totals = new Map<Currency, number>();
  let total = 0;
  for (const it of items) {
    const v = convert(it.amount, it.currency, display, rates);
    totals.set(it.currency, (totals.get(it.currency) ?? 0) + v);
    total += v;
  }

  const present = CURRENCIES.filter((c) => (totals.get(c) ?? 0) > 0).map((c) => ({
    currency: c,
    value: totals.get(c) ?? 0,
  }));
  if (total <= 0) return present.map((p) => ({ ...p, pct: 0 }));

  const parts = present.map((p) => {
    const exact = (p.value / total) * 100;
    const floor = Math.floor(exact);
    return { currency: p.currency, value: p.value, pct: floor, rem: exact - floor };
  });
  let left = 100 - parts.reduce((s, p) => s + p.pct, 0);
  [...parts]
    .sort((a, b) => b.rem - a.rem)
    .forEach((p) => {
      if (left > 0) {
        p.pct += 1;
        left -= 1;
      }
    });

  return parts.map(({ currency, value, pct }) => ({ currency, value, pct }));
}
