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
  GBP: "£",
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

/**
 * Datas no app vêm em dois formatos:
 *
 *   1. "Calendar date" — string "YYYY-MM-DD" vinda de coluna `date` do Postgres.
 *      Sem hora, sem fuso. Representa um dia literal e DEVE renderizar sempre
 *      como aquele dia, independente do fuso do leitor.
 *
 *   2. "Instant" — objeto Date ou string ISO completa ("…T…Z") vinda de
 *      `timestamptz`. Aí sim a renderização passa por `America/Sao_Paulo`.
 *
 * O bug clássico era usar `new Date("2026-06-05")` (JS interpreta como UTC
 * meia-noite) e formatar em SP (UTC-3), o que jogava o dia 5 pra 4. Os
 * formatadores abaixo detectam o caso 1 e formatam em UTC pra evitar o shift.
 */

const SP_TIMEZONE = "America/Sao_Paulo";
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

const DATE_FULL_SP = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: SP_TIMEZONE,
});

const DATE_FULL_UTC = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const DATE_SHORT_SP = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  timeZone: SP_TIMEZONE,
});

const DATE_SHORT_UTC = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

const DATE_NUMERIC_SP = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: SP_TIMEZONE,
});

const DATE_NUMERIC_UTC = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

const TIME_HM = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: SP_TIMEZONE,
});

const MONTH_YEAR_SP = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: SP_TIMEZONE,
});

const MONTH_YEAR_UTC = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function isCalendarDate(v: Date | string): v is string {
  return typeof v === "string" && DATE_ONLY_RE.test(v);
}

function toUtcMidnight(s: string): Date {
  return new Date(s + "T00:00:00Z");
}

export function formatDateFull(d: Date | string): string {
  if (isCalendarDate(d)) return DATE_FULL_UTC.format(toUtcMidnight(d));
  const date = typeof d === "string" ? new Date(d) : d;
  return DATE_FULL_SP.format(date);
}

export function formatDateShort(d: Date | string): string {
  if (isCalendarDate(d)) {
    return DATE_SHORT_UTC.format(toUtcMidnight(d)).replace(".", "");
  }
  const date = typeof d === "string" ? new Date(d) : d;
  return DATE_SHORT_SP.format(date).replace(".", "");
}

/** dd/mm/yyyy (substitui o uso direto de `toLocaleDateString("pt-BR")` em datas) */
export function formatDateNumeric(d: Date | string): string {
  if (isCalendarDate(d)) return DATE_NUMERIC_UTC.format(toUtcMidnight(d));
  const date = typeof d === "string" ? new Date(d) : d;
  return DATE_NUMERIC_SP.format(date);
}

export function formatTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return TIME_HM.format(date).replace(":", "h");
}

export function formatMonthYear(d: Date | string): string {
  if (isCalendarDate(d)) return MONTH_YEAR_UTC.format(toUtcMidnight(d));
  const date = typeof d === "string" ? new Date(d) : d;
  return MONTH_YEAR_SP.format(date);
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
