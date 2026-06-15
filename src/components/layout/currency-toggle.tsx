import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";
import type { Currency } from "@/money/currency";

const OPTIONS: { cur: Currency; label: string }[] = [
  { cur: "BRL", label: "R$" },
  { cur: "EUR", label: "€" },
];

/** Switch de moeda de exibição (R$ / €), igual ao protótipo. */
export function CurrencyToggle() {
  const displayCurrency = useUI((s) => s.displayCurrency);
  const setDisplayCurrency = useUI((s) => s.setDisplayCurrency);

  return (
    <div className="flex p-1 rounded-xl bg-bg border border-border">
      {OPTIONS.map(({ cur, label }) => {
        const active = displayCurrency === cur;
        return (
          <button
            key={cur}
            type="button"
            onClick={() => setDisplayCurrency(cur)}
            className={cn(
              "px-3 py-1 rounded-lg text-[13px] font-semibold transition-colors",
              active ? "bg-teal text-white" : "text-muted hover:text-text",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
