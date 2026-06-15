import { convert, CURRENCIES, type Currency } from "./currency";

/** Cor de cada moeda nas barras/legendas de composição. */
export const CUR_COLOR: Record<Currency, string> = {
  BRL: "#2C7A7B",
  EUR: "#5B7B9A",
  USD: "#7FB2B2",
  GBP: "#9FB3C8",
};

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
): CurrencySlice[] {
  const totals = new Map<Currency, number>();
  let total = 0;
  for (const it of items) {
    const v = convert(it.amount, it.currency, display);
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
