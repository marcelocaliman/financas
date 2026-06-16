import { cn } from "@/lib/utils";
import { formatMoney, type Currency } from "@/money/currency";
import { useUI } from "@/store/ui";

export const MONEY_MASK = "••••";

/** Valor monetário formatado (números tabulares). Oculta quando o modo privado está ligado. */
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
  const hidden = useUI((s) => s.numbersHidden);
  return (
    <span className={cn("tabular", className)}>
      {hidden ? MONEY_MASK : formatMoney(value, currency, options)}
    </span>
  );
}
