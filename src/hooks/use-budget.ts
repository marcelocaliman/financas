import { useLiveQuery } from "dexie-react-hooks";
import { repository } from "@/data/dexie-repository";
import type { Expense, Income } from "@/domain/types";

/** Receitas + gastos do orçamento, reativos. `null` enquanto carrega. */
export function useBudget(): { expenses: Expense[]; incomes: Income[] } | null {
  const data = useLiveQuery(async () => {
    const [expenses, incomes] = await Promise.all([
      repository.listExpenses(),
      repository.listIncomes(),
    ]);
    return { expenses, incomes };
  });
  return data ?? null;
}
