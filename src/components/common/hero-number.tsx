import { useEffect, useRef, useState } from "react";
import { formatMoney, type Currency } from "@/money/currency";
import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";

/** Conta de 0 (ou do valor anterior) até o alvo, com easing — sem libs. */
function useCountUp(target: number, duration = 650): number {
  const [val, setVal] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setVal(target);
      fromRef.current = target;
      return;
    }
    let start: number | null = null;
    const tick = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(from + (target - from) * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return val;
}

/** Número-herói iluminado por dentro, com count-up tabular. */
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
  const display = useCountUp(hidden ? 0 : value);
  return (
    <span className={cn("hero-number", value < 0 && !hidden && "hero-number-neg", className)}>
      {hidden ? "••••••" : formatMoney(display, currency)}
    </span>
  );
}
