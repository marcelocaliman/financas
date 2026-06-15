import { cn } from "@/lib/utils";
import { CURRENCY_SYMBOL, type Currency } from "@/money/currency";

/** Selo luminoso da moeda nativa do item (R$ / € / US$ / £), com glow por moeda. */
export function CurrencyBadge({
  currency,
  className,
}: {
  currency: Currency;
  className?: string;
}) {
  return (
    <span className={cn("chip", `chip-${currency}`, "tabular", className)}>
      {CURRENCY_SYMBOL[currency]}
    </span>
  );
}
