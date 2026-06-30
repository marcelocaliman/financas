import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { convert, CURRENCIES, type Currency } from "@/money/currency";
import { Money } from "@/components/common/money";

/**
 * O MESMO patrimônio líquido expresso nas OUTRAS moedas em que o usuário tem exposição (≈, pois é
 * conversão pela taxa do dia). Logo abaixo do número-herói, discreto e alinhado. Some quando não há
 * outra moeda. Valor financeiro → respeita o modo privado (<Money> mascara).
 */
export function NetWorthInCurrencies({ netWorth, currencies }: { netWorth: number; currencies: Currency[] }) {
  const display = useUI((s) => s.displayCurrency);
  const rates = useRates((s) => s.rates);

  // Moedas com exposição real, exceto a de exibição (já é o número grande), em ordem estável.
  const others = CURRENCIES.filter((c) => c !== display && currencies.includes(c));
  if (others.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1.5 text-[14px] text-muted">
      <span className="text-faint text-[13px]" aria-hidden>
        ≈
      </span>
      {others.map((c) => (
        <Money key={c} value={convert(netWorth, display, c, rates)} currency={c} className="font-semibold tabular" />
      ))}
    </div>
  );
}
