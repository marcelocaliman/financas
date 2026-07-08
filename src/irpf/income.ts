import type { Income } from "@/domain/types";
import type { Currency } from "@/money/currency";

// Resumo de RENDIMENTOS do ano-base pro Organizador de IRPF — só o total BRUTO por categoria (do que o
// usuário registrou no orçamento). NÃO classifica em ficha (tributável × isento × exclusivo) nem calcula
// imposto — isso é juízo do contador. Puro e testável.

export interface IncomeSummaryRow {
  categoryId: string;
  currency: Currency;
  total: number;
  count: number;
}

/** Soma as receitas do ANO-BASE por categoria + moeda (não converte moeda — conversão é juízo fiscal). */
export function summarizeIncome(incomes: Income[], baseYear: number): IncomeSummaryRow[] {
  const prefix = `${baseYear}-`;
  const map = new Map<string, IncomeSummaryRow>();
  for (const i of incomes) {
    if (!i.month.startsWith(prefix)) continue;
    const key = `${i.categoryId}|${i.currency}`;
    const row = map.get(key) ?? { categoryId: i.categoryId, currency: i.currency, total: 0, count: 0 };
    row.total += i.amount;
    row.count += 1;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}
