/**
 * Formatters — toda formatação de números/datas/moeda passa por aqui.
 * Fuso e locale fixos em pt-BR / America/Sao_Paulo.
 */

import { formatCurrency, formatCurrencyCompact } from "@/lib/financial/currency";
import type { Currency } from "@/types/database";

const NUM = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(
  value: number | string | null | undefined,
  currency: Currency = "BRL",
): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return formatCurrency(n, currency);
}

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  BRL: "R$",
  EUR: "€",
  USD: "US$",
};

/**
 * Money sem o símbolo. Útil quando o símbolo é renderizado separado em tipografia menor.
 */
export function formatMoneyParts(
  value: number | string | null | undefined,
  currency: Currency = "BRL",
): {
  currency: string;
  integer: string;
  cents: string;
  sign: "+" | "-" | "";
} {
  const symbol = CURRENCY_SYMBOLS[currency];
  if (value === null || value === undefined || value === "") {
    return { currency: symbol, integer: "—", cents: "", sign: "" };
  }
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return { currency: symbol, integer: "—", cents: "", sign: "" };

  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const [int, dec = "00"] = NUM.format(abs).split(",");
  return { currency: symbol, integer: int, cents: dec, sign };
}

export function formatMoneyCompact(value: number, currency: Currency = "BRL"): string {
  return formatCurrencyCompact(value, currency);
}

export function formatPercent(value: number, decimals = 1): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercentDelta(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1).replace(".", ",")}%`;
}

export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/* ============================== DATAS ============================== */

const DATE_FULL = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

const DATE_SHORT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  timeZone: "America/Sao_Paulo",
});

const TIME_HM = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

const MONTH_YEAR = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

export function formatDateFull(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return DATE_FULL.format(date);
}

export function formatDateShort(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return DATE_SHORT.format(date).replace(".", "");
}

export function formatTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return TIME_HM.format(date).replace(":", "h");
}

export function formatMonthYear(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return MONTH_YEAR.format(date);
}

/**
 * Saudação por horário (Brasil/SP).
 */
export function greetingForHour(hour: number): "manhã" | "tarde" | "noite" {
  if (hour < 12) return "manhã";
  if (hour < 18) return "tarde";
  return "noite";
}

export function getGreeting(now: Date = new Date()): string {
  const localHour = Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      hour12: false,
      timeZone: "America/Sao_Paulo",
    }).format(now),
  );
  const period = greetingForHour(localHour);
  return `Boa ${period}`;
}
