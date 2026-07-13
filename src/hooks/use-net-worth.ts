import { useMemo } from "react";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { convert, type Currency } from "@/money/currency";

/** Patrimônio líquido (ativos − passivos) na moeda de exibição — usado pela Projeção
 *  (página + summary) como fallback quando o FIRE ainda não carregou. */
export function useNetWorth(): number {
  const disp = useUI((s) => s.displayCurrency);
  const rates = useRates((s) => s.rates);
  const data = usePatrimonio();
  return useMemo(() => {
    if (!data) return 0;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    return (
      data.assets.reduce((s, a) => s + conv(a.amount, a.currency), 0) -
      data.liabilities.reduce((s, l) => s + conv(l.amount, l.currency), 0)
    );
  }, [data, disp, rates]);
}
