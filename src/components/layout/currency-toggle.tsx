import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";
import { CURRENCIES, CURRENCY_SYMBOL } from "@/money/currency";

/** Switch da moeda de exibição (R$ / € / US$ / £). */
export function CurrencyToggle() {
  const displayCurrency = useUI((s) => s.displayCurrency);
  const setDisplayCurrency = useUI((s) => s.setDisplayCurrency);

  return (
    <div className="flex gap-0.5 p-0.5 rounded-[12px] bg-card2 border border-border">
      {CURRENCIES.map((cur) => {
        const active = displayCurrency === cur;
        return (
          <button
            key={cur}
            type="button"
            onClick={() => setDisplayCurrency(cur)}
            className={cn(
              "px-2.5 py-1 rounded-[9px] text-[12.5px] font-semibold tabular transition-all",
              active
                ? "bg-accent text-[#0A0B0D]"
                : "text-muted hover:text-text",
            )}
          >
            {CURRENCY_SYMBOL[cur]}
          </button>
        );
      })}
    </div>
  );
}
