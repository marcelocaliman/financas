import { convert, type Currency, type RateTable } from "@/money/currency";
import type { Expense, Income } from "@/domain/types";

/**
 * Saldo (poupança) do mês = receitas − gastos do orçamento, convertido pra `currency`.
 * Retorna `null` quando NÃO há lançamento no mês — assim a ponte com o Histórico não
 * sugere um aporte falso de R$ 0 onde o usuário simplesmente não preencheu o orçamento.
 * Saldo negativo (gastou mais do que entrou) é válido = desinvestimento/retirada.
 */
export function budgetSaldoForMonth(
  month: string,
  budget: { incomes: Income[]; expenses: Expense[] } | null | undefined,
  currency: Currency,
  rates: RateTable,
): number | null {
  if (!budget) return null;
  const inc = budget.incomes.filter((i) => i.month === month);
  const exp = budget.expenses.filter((e) => e.month === month);
  if (inc.length === 0 && exp.length === 0) return null;
  const totalInc = inc.reduce((s, i) => s + convert(i.amount, i.currency, currency, rates), 0);
  const totalExp = exp.reduce((s, e) => s + convert(e.amount, e.currency, currency, rates), 0);
  return totalInc - totalExp;
}
