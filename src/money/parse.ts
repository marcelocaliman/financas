import { type Currency } from "./currency";

const LOCALE: Record<Currency, string> = {
  BRL: "pt-BR",
  EUR: "it-IT",
  USD: "en-US",
  GBP: "en-GB",
};

/**
 * Parser tolerante de valores. Decide o separador DECIMAL com regra robusta:
 * - vírgula E ponto presentes → o separador mais à DIREITA é o decimal;
 * - só um tipo de separador, uma vez, com 1–2 dígitos depois → decimal ("12,5", "12.50");
 * - só um tipo, repetido OU com exatamente 3 dígitos depois → MILHAR ("1.500", "320.000", "1.234.567").
 * Assim "1.500" → 1500 (e não 1,5). Retorna null se não houver número.
 */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[^\d.,-]/g, "");
  const neg = cleaned.trim().startsWith("-");
  const body = cleaned.replace(/-/g, "");
  if (!body) return null;

  const hasComma = body.includes(",");
  const hasDot = body.includes(".");
  let decimalSep: "." | "," | null = null;

  if (hasComma && hasDot) {
    decimalSep = body.lastIndexOf(",") > body.lastIndexOf(".") ? "," : ".";
  } else if (hasComma || hasDot) {
    const sep = hasComma ? "," : ".";
    const count = body.split(sep).length - 1;
    const after = body.length - body.lastIndexOf(sep) - 1;
    decimalSep = count === 1 && after !== 3 ? sep : null; // único e não-3-dígitos → decimal
  }

  let norm: string;
  if (decimalSep) {
    const di = body.lastIndexOf(decimalSep);
    const intPart = body.slice(0, di).replace(/[.,]/g, "");
    const fracPart = body.slice(di + 1).replace(/[.,]/g, "");
    norm = `${intPart}.${fracPart}`;
  } else {
    norm = body.replace(/[.,]/g, "");
  }

  const n = Number(norm);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

/** Formato para EXIBIÇÃO agregada (totais): inteiro, sem símbolo. */
export function formatAmount(value: number, currency: Currency): string {
  return new Intl.NumberFormat(LOCALE[currency], { maximumFractionDigits: 0 }).format(value);
}

/** Formato para EDIÇÃO (célula de valor): preserva até 2 casas, sem símbolo. */
export function formatAmountEdit(value: number, currency: Currency): string {
  return new Intl.NumberFormat(LOCALE[currency], {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}
