import { formatMoney, type Currency } from "@/money/currency";
import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";

/**
 * Número-herói: peso + brilho gradiente (CSS). Mostra o valor DIRETO — sem
 * animação de contagem (num app financeiro, número que "conta" parece que o valor
 * está mudando). Oculta com •••••• quando o modo privado está ligado.
 */
export function HeroNumber({
  value,
  currency,
  className,
}: {
  value: number;
  currency: Currency;
  className?: string;
}) {
  const hidden = useUI((s) => s.numbersHidden);
  return (
    <span className={cn("hero-number", value < 0 && !hidden && "hero-number-neg", className)}>
      {hidden ? "••••••" : formatMoney(value, currency)}
    </span>
  );
}
