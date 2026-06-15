import { cn } from "@/lib/utils";
import { formatMoney, type Currency } from "@/money/currency";

/** Valor monetário já formatado, com números tabulares. */
export function Money({
  value,
  currency,
  className,
  options,
}: {
  value: number;
  currency: Currency;
  className?: string;
  options?: Intl.NumberFormatOptions;
}) {
  return (
    <span className={cn("tabular-nums", className)}>
      {formatMoney(value, currency, options)}
    </span>
  );
}
