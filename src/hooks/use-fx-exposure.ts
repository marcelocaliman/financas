import { useMemo } from "react";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { convert, type Currency } from "@/money/currency";

/** Exposição cambial do patrimônio: líquido por moeda, convertido pra principal.
 *  Compartilhado pela página Multimoeda, pelo summary do accordion e pelo tooltip do menu. */
export function useFxExposure() {
  const base = useUI((s) => s.baseCurrency);
  const rates = useRates((s) => s.rates);
  const data = usePatrimonio();
  return useMemo(() => {
    if (!data) return { rows: [] as { currency: Currency; principal: number }[], total: 0, foreign: 0, magnitude: 0 };
    const net = new Map<Currency, number>();
    for (const a of data.assets) net.set(a.currency, (net.get(a.currency) ?? 0) + a.amount);
    for (const l of data.liabilities) net.set(l.currency, (net.get(l.currency) ?? 0) - l.amount);
    const rows = [...net.entries()]
      .map(([currency, native]) => ({ currency, principal: convert(native, currency, base, rates) }))
      .filter((x) => Math.abs(x.principal) > 0.5)
      .sort((a, b) => Math.abs(b.principal) - Math.abs(a.principal));
    const total = rows.reduce((s, x) => s + x.principal, 0);
    const foreign = rows.filter((x) => x.currency !== base).reduce((s, x) => s + x.principal, 0);
    // Soma das MAGNITUDES — base das %, sempre coerente mesmo com passivo (líquido negativo).
    const magnitude = rows.reduce((s, x) => s + Math.abs(x.principal), 0);
    return { rows, total, foreign, magnitude };
  }, [data, base, rates]);
}
