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

/** Formato para EDIÇÃO de VALOR monetário: locale + SEMPRE 2 casas (ex.: 320.000,00). */
export function formatAmountEdit(value: number, currency: Currency): string {
  return new Intl.NumberFormat(LOCALE[currency], {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formato para EDIÇÃO de um número genérico (preço médio, qtd, taxa): locale +
 * casas controladas. `decimals` fixo → exatamente N casas (ex.: preço médio = 2);
 * indefinido → flexível (qtd fracionável, sem zeros à toa), sempre com milhar.
 */
export function formatNumberEdit(
  value: number | undefined,
  currency: Currency,
  decimals?: number,
): string {
  if (value == null) return "";
  return new Intl.NumberFormat(LOCALE[currency], {
    minimumFractionDigits: decimals ?? 0,
    maximumFractionDigits: decimals ?? 8,
  }).format(value);
}

/**
 * Parser ESTRITO por locale: usa os separadores REAIS do locale pra desfazer EXATAMENTE
 * o que formatAmountEdit/formatNumberEdit produziram. Sem heurística — evita o bug do
 * parseAmount com decimal de 3 dígitos (em pt-BR "0,005" → 0.005, e não 5). Usado nas
 * células da grade, que formatam e editam no mesmo locale.
 */
export function parseLocaleNumber(input: string, currency: Currency): number | null {
  const s = input.trim();
  if (s === "") return null;
  const parts = new Intl.NumberFormat(LOCALE[currency]).formatToParts(12345.6);
  const group = parts.find((p) => p.type === "group")?.value ?? "";
  const decimal = parts.find((p) => p.type === "decimal")?.value ?? ".";
  let body = s;
  if (group) body = body.split(group).join(""); // remove o separador de milhar
  body = body.split(decimal).join("."); // decimal do locale → ponto
  body = body.replace(/[^\d.-]/g, ""); // sobra só dígito/ponto/menos
  if (body === "" || body === "-" || body === ".") return null;
  const n = Number(body);
  return Number.isFinite(n) ? n : null;
}
