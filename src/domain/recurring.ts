import type { Expense, Income } from "@/domain/types";

/**
 * Recorrências do orçamento (lógica PURA e testável).
 *
 * Regra: um lançamento marcado `recurring` é um "fixo" (aluguel, salário, assinatura).
 * Ao abrir um mês NOVO/futuro ainda sem fixos, trazemos os fixos do mês anterior mais
 * recente que os tenha — cada cópia é uma linha independente (id novo), mantendo a marca
 * `recurring` pra propagar adiante. NUNCA reescreve o passado (quem chama filtra isso).
 *
 * Idempotente: se o mês-alvo já tem QUALQUER fixo, não traz nada (não duplica). O usuário
 * pode apagar um fixo de um mês específico sem que ele volte enquanto restar outro fixo lá.
 */
export interface RecurringPlan {
  expenses: Expense[];
  incomes: Income[];
}

const EMPTY: RecurringPlan = { expenses: [], incomes: [] };

export function planRecurring(
  expenses: Expense[],
  incomes: Income[],
  target: string,
  newId: () => string,
): RecurringPlan {
  // Já há fixo no mês-alvo → nada a fazer (idempotência).
  const hasTarget =
    expenses.some((e) => e.month === target && e.recurring) ||
    incomes.some((i) => i.month === target && i.recurring);
  if (hasTarget) return EMPTY;

  // Mês-fonte = o mais recente ANTES do alvo que contenha algum fixo ("AAAA-MM" ordena lexicograficamente).
  const months = [...expenses, ...incomes]
    .filter((x) => x.recurring && x.month < target)
    .map((x) => x.month);
  if (months.length === 0) return EMPTY;
  const src = months.sort().at(-1)!;

  return {
    expenses: expenses
      .filter((e) => e.month === src && e.recurring)
      .map((e) => ({ ...e, id: newId(), month: target })),
    incomes: incomes
      .filter((i) => i.month === src && i.recurring)
      .map((i) => ({ ...i, id: newId(), month: target })),
  };
}
