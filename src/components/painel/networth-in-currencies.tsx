import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { convert, CURRENCIES } from "@/money/currency";
import { Money } from "@/components/common/money";

/**
 * O MESMO patrimônio líquido expresso nas OUTRAS moedas principais (≈, conversão pela taxa do dia)
 * — "quanto eu valho em euro/dólar/libra", mesmo com tudo em uma moeda só. Logo abaixo do número-
 * herói, discreto e alinhado. Valor financeiro → respeita o modo privado (<Money> mascara).
 */
export function NetWorthInCurrencies({ netWorth }: { netWorth: number }) {
  const display = useUI((s) => s.displayCurrency);
  const rates = useRates((s) => s.rates);

  // Todas as moedas principais, exceto a de exibição (que já é o número grande), em ordem estável.
  const others = CURRENCIES.filter((c) => c !== display);
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
