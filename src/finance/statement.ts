import { convert, type Currency, type RateTable } from "@/money/currency";
import type { Expense } from "@/domain/types";

/**
 * Faturas do cartão (ou qualquer gasto "guarda-chuva"): um gasto pode estar DENTRO de outro
 * (`parentId` = id da fatura). O filho é DISCRIMINADO (aparece, tem categoria) mas o valor dele já
 * está embutido no total da fatura — então ele NÃO soma no total do orçamento. Evita dupla contagem.
 * Tudo PURO/testável.
 *
 * Órfão (parentId aponta pra um pai que não existe no conjunto, ex.: fatura apagada) NÃO é tratado
 * como filho — vira top-level, pra o valor nunca sumir do total.
 */

/** Ids dos gastos que são FILHOS de verdade — parentId aponta pra um pai que EXISTE no conjunto.
 *  (Órfão, cujo pai não existe, NÃO entra aqui: ele conta como top-level.) */
export function childExpenseIds(expenses: Expense[]): Set<string> {
  const ids = new Set(expenses.map((e) => e.id));
  const out = new Set<string>();
  for (const e of expenses) if (e.parentId && ids.has(e.parentId)) out.add(e.id);
  return out;
}

/** Só os gastos TOP-LEVEL (faturas + avulsos): os itens DENTRO de uma fatura não entram. */
export function topLevelExpenses(expenses: Expense[]): Expense[] {
  const kids = childExpenseIds(expenses);
  return expenses.filter((e) => !kids.has(e.id));
}

/** Total de gastos (só top-level), convertido pra `display`. */
export function expenseTotal(expenses: Expense[], display: Currency, rates: RateTable): number {
  return topLevelExpenses(expenses).reduce((s, e) => s + convert(e.amount, e.currency, display, rates), 0);
}

/** Filhos de uma fatura. */
export function childrenOf(expenses: Expense[], parentId: string): Expense[] {
  return expenses.filter((e) => e.parentId === parentId);
}

/** É uma fatura? (tem ≥1 filho no conjunto). */
export function hasChildren(expenses: Expense[], id: string): boolean {
  return expenses.some((e) => e.parentId === id);
}

/** Sobra "não discriminado" = valor da fatura − Σ filhos (na moeda da fatura). Negativo = super-itemizado. */
export function statementResidual(parent: Expense, children: Expense[], rates: RateTable): number {
  const itemized = children.reduce((s, c) => s + convert(c.amount, c.currency, parent.currency, rates), 0);
  return parent.amount - itemized;
}

export interface ExpenseLeaf {
  id: string;
  categoryId: string;
  name: string;
  amount: number;
  currency: Currency;
  /** true = sobra "não discriminado" de uma fatura (não é um lançamento real). */
  residual?: boolean;
}

/**
 * Gastos FOLHA pra composição/gráficos: avulsos + filhos + 1 "não discriminado" por fatura. O
 * resíduo herda a categoria/moeda/nome da fatura e só é emitido quando > 0. A soma das folhas é
 * EXATAMENTE o total top-level QUANDO a fatura não está super-itemizada (Σ filhos ≤ valor da
 * fatura). No caso raro de super-itemização (Σ filhos > fatura, resíduo < 0, erro do usuário), o
 * resíduo é omitido e a composição soma mais que o total — o total-herói segue correto (top-level).
 */
export function expenseLeaves(expenses: Expense[], rates: RateTable): ExpenseLeaf[] {
  const ids = new Set(expenses.map((e) => e.id));
  const kidsByParent = new Map<string, Expense[]>();
  for (const e of expenses) {
    if (e.parentId && ids.has(e.parentId)) {
      const arr = kidsByParent.get(e.parentId);
      if (arr) arr.push(e);
      else kidsByParent.set(e.parentId, [e]);
    }
  }
  const leaves: ExpenseLeaf[] = [];
  for (const e of expenses) {
    if (e.parentId && ids.has(e.parentId)) {
      // filho → entra como ele mesmo
      leaves.push({ id: e.id, categoryId: e.categoryId, name: e.name, amount: e.amount, currency: e.currency });
      continue;
    }
    const kids = kidsByParent.get(e.id);
    if (kids && kids.length) {
      // fatura → só a sobra não discriminada (os filhos já entraram acima)
      const residual = statementResidual(e, kids, rates);
      if (residual > 0.005) {
        leaves.push({ id: `${e.id}::res`, categoryId: e.categoryId, name: e.name, amount: residual, currency: e.currency, residual: true });
      }
    } else {
      // avulso → ele mesmo
      leaves.push({ id: e.id, categoryId: e.categoryId, name: e.name, amount: e.amount, currency: e.currency });
    }
  }
  return leaves;
}
