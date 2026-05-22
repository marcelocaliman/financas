"use client";

import { cn } from "@/lib/utils/cn";
import { convert, formatCurrency, formatCurrencyCompact } from "@/lib/financial/currency";
import type { Currency } from "@/types/database";
import { useMoneyContext } from "./money-provider";
import { maskMoneyString, usePrivacy } from "./privacy-provider";

/**
 * Renderiza um valor monetário convertido para a moeda preferida do usuário.
 *
 * Comportamento de linha secundária:
 *  - Se a moeda do item difere da displayCurrency, mostra o ORIGINAL embaixo
 *    (ex: conta em € com display R$ → "R$459 / €85").
 *  - Se `showComparison=true` E a moeda de comparação estiver ligada E for
 *    diferente da primária renderizada, mostra a COMPARAÇÃO embaixo
 *    (ex: R$1.000 / ≈ €174).
 *  - Se ambas se aplicam, prioriza o original (mais informativo).
 *
 * Props:
 * - `value`: valor numérico na moeda `currency`
 * - `currency`: moeda do valor (BRL/EUR/USD). Default BRL pra retrocompat.
 * - `secondary`: força exibir o valor original (override do auto-detect)
 * - `showComparison`: ativa linha de comparação quando aplicável
 * - `compact`: formato compacto (R$ 1.234)
 */
export function Money({
  value,
  currency = "BRL",
  secondary,
  showComparison = false,
  compact = false,
  className,
  toneClassName,
  secondaryClassName,
}: {
  value: number | null | undefined;
  currency?: Currency;
  secondary?: boolean;
  showComparison?: boolean;
  compact?: boolean;
  className?: string;
  toneClassName?: string;
  secondaryClassName?: string;
}) {
  const { displayCurrency, comparisonCurrency, rates } = useMoneyContext();
  const { hidden } = usePrivacy();

  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return <span className={cn("font-mono", className)}>—</span>;
  }

  const numeric = Number(value);
  const converted = convert(numeric, currency, displayCurrency, rates);
  const primaryValue = converted ?? numeric;
  const primaryCurrency: Currency = converted !== null ? displayCurrency : currency;

  const fmt = compact ? formatCurrencyCompact : formatCurrency;
  const maybeMask = (s: string) => (hidden ? maskMoneyString(s) : s);

  // Decide qual secundário (se algum) renderizar
  const showOriginal = secondary ?? currency !== displayCurrency;
  const wantsComparison =
    showComparison &&
    comparisonCurrency != null &&
    comparisonCurrency !== primaryCurrency;

  let secondaryText: string | null = null;
  if (showOriginal && currency !== primaryCurrency) {
    secondaryText = fmt(numeric, currency);
  } else if (wantsComparison) {
    const compConverted = convert(numeric, currency, comparisonCurrency, rates);
    if (compConverted !== null) {
      secondaryText = `≈ ${fmt(compConverted, comparisonCurrency)}`;
    }
  }

  return (
    <span className={cn("inline-flex flex-col items-end leading-tight", className)}>
      <span className={cn("font-mono tabular-nums", toneClassName)}>
        {maybeMask(fmt(primaryValue, primaryCurrency))}
      </span>
      {secondaryText ? (
        <span
          className={cn(
            "text-[10.5px] text-faint-foreground font-mono tabular-nums tracking-[0.02em]",
            secondaryClassName,
          )}
        >
          {maybeMask(secondaryText)}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Versão "inline": só o valor primário, sem secundário, sem flex column.
 * Útil em rótulos curtos ou linhas densas.
 */
export function MoneyInline({
  value,
  currency = "BRL",
  compact = false,
  className,
}: {
  value: number | null | undefined;
  currency?: Currency;
  compact?: boolean;
  className?: string;
}) {
  const { displayCurrency, rates } = useMoneyContext();
  const { hidden } = usePrivacy();

  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return <span className={cn("font-mono", className)}>—</span>;
  }
  const numeric = Number(value);
  const converted = convert(numeric, currency, displayCurrency, rates);
  const final = converted ?? numeric;
  const finalCurrency: Currency = converted !== null ? displayCurrency : currency;
  const fmt = compact ? formatCurrencyCompact : formatCurrency;
  const formatted = fmt(final, finalCurrency);
  return (
    <span className={cn("font-mono tabular-nums", className)}>
      {hidden ? maskMoneyString(formatted) : formatted}
    </span>
  );
}
