"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * MoneyInput — input controlado em centavos.
 * O usuário digita só os centavos (sem separador) e a formatação acontece visualmente.
 * Ao salvar, lemos `valueAsNumber` (em reais, ex.: 1234.56).
 *
 * Padrão: o componente é "uncontrolled" (use um <input type="hidden" name="amount">
 * com o valor numérico em reais, controlado por estado interno).
 */
export function MoneyInput({
  name,
  defaultValue,
  onValueChange,
  autoFocus,
  className,
  disabled,
  placeholder = "0,00",
  id,
}: {
  name: string;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  autoFocus?: boolean;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
}) {
  const [cents, setCents] = React.useState<number>(() => {
    if (defaultValue === undefined || defaultValue === null) return 0;
    return Math.round(defaultValue * 100);
  });

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
      // Limite numérico (R$ 99.999.999,99)
      if (next > 9_999_999_999) return;
      setCents(next);
      onValueChange?.(next / 100);
    } else {
      e.preventDefault();
    }
  };

  const display = formatCentsBR(cents);
  const numericValue = cents / 100;

  return (
    <div
      className={cn(
        "flex h-12 items-center rounded-[8px] border border-border-strong bg-surface px-4",
        "transition-[border-color,box-shadow] duration-150",
        "focus-within:border-navy-500 focus-within:ring-2 focus-within:ring-navy-100",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      <span className="font-mono text-[14px] text-faint-foreground mr-2">R$</span>
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
        className="flex-1 font-mono text-[22px] tracking-[-0.01em] bg-transparent outline-none placeholder:text-faint-foreground placeholder:font-light text-foreground caret-navy-700"
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
  const intStr = intPart
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${intStr},${dec}`;
}
