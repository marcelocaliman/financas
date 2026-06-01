"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { CURRENCY_SYMBOLS } from "@/lib/financial/currency";
import type { Currency } from "@/types/database";

/**
 * MoneyInput — input controlado em centavos.
 * O usuário digita dígitos puros (sem vírgula) e a formatação BR é cosmética.
 *
 * size:
 *   "md" (default) → 15px, mesma altura/peso de inputs de form (h-10)
 *   "lg" → 22px, para contextos hero/destaque (h-12)
 */
type Size = "md" | "lg";

export function MoneyInput({
  name,
  defaultValue,
  value,
  onValueChange,
  autoFocus,
  className,
  disabled,
  placeholder = "0,00",
  id,
  size = "md",
  currency = "BRL",
}: {
  name: string;
  defaultValue?: number;
  /**
   * Override controlado: quando muda, sincroniza o valor interno. Continua
   * editável pelo teclado (a digitação atualiza o estado interno). Use pra
   * dirigir o campo de fora (ex.: parser de entrada rápida).
   */
  value?: number;
  onValueChange?: (value: number) => void;
  autoFocus?: boolean;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  size?: Size;
  /** Símbolo a exibir como prefixo. Default R$. */
  currency?: Currency;
}) {
  const [cents, setCents] = React.useState<number>(() => {
    const seed = value ?? defaultValue;
    if (seed === undefined || seed === null) return 0;
    return Math.round(seed * 100);
  });

  // Sincroniza quando o `value` controlado muda (padrão React 19: ajustar
  // estado durante o render comparando com o valor anterior).
  const [prevValue, setPrevValue] = React.useState(value);
  if (value !== undefined && value !== prevValue) {
    setPrevValue(value);
    setCents(Math.round(value * 100));
  }

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = Math.floor(cents / 10);
      setCents(next);
      onValueChange?.(next / 100);
      return;
    }
    if (e.key === "Enter" || e.key === "Tab") return;
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      const next = cents * 10 + parseInt(e.key, 10);
      if (next > 9_999_999_999) return;
      setCents(next);
      onValueChange?.(next / 100);
    } else {
      e.preventDefault();
    }
  };

  const display = formatCentsBR(cents);
  const numericValue = cents / 100;

  const sizes = {
    md: {
      wrap: "h-10 px-3",
      prefix: "text-[12.5px] mr-1.5",
      input: "text-[15px]",
    },
    lg: {
      wrap: "h-12 px-4",
      prefix: "text-[14px] mr-2",
      input: "text-[22px]",
    },
  } as const;
  const s = sizes[size];

  return (
    <div
      className={cn(
        "flex items-center rounded-[8px] border border-border-strong bg-surface",
        s.wrap,
        "transition-[border-color,box-shadow] duration-150",
        "focus-within:border-navy-500 focus-within:shadow-[0_0_0_3px_var(--color-navy-100)]",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      <span className={cn("font-mono text-faint-foreground shrink-0", s.prefix)}>
        {CURRENCY_SYMBOLS[currency]}
      </span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        readOnly
        value={display === "0,00" ? "" : display}
        onKeyDown={handleKey}
        autoFocus={autoFocus}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "flex-1 min-w-0 font-mono tracking-[-0.01em] bg-transparent outline-none placeholder:text-faint-foreground placeholder:font-light text-foreground caret-navy-700 tabular-nums",
          s.input,
        )}
      />
      <input type="hidden" name={name} value={numericValue.toFixed(2)} />
    </div>
  );
}

function formatCentsBR(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const intPart = Math.floor(abs / 100);
  const dec = (abs % 100).toString().padStart(2, "0");
  const intStr = intPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${intStr},${dec}`;
}
