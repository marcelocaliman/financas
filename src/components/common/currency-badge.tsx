import { cn } from "@/lib/utils";
import { CURRENCY_SYMBOL, type Currency } from "@/money/currency";

/** Selo da moeda nativa do item (R$ / €…). */
export function CurrencyBadge({ currency }: { currency: Currency }) {
  const isBRL = currency === "BRL";
  return (
    <span
      className={cn(
        "px-1.5 py-0.5 rounded text-[11px] font-bold leading-none",
        isBRL ? "bg-teal-soft text-teal" : "bg-eur-soft text-eur",
      )}
    >
      {CURRENCY_SYMBOL[currency]}
    </span>
  );
}
