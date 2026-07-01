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

/**
 * Recorrência EFETIVA por gasto: um FILHO (dentro de uma fatura) segue a recorrência do PAI; um
 * top-level segue a si mesmo. Assim a fatura recorre/copia COM os seus itens, numa passada só —
 * nunca sobra um filho órfão sobre a fatura cheia (que causaria dupla contagem).
 */
export function effectiveRecurringIds(expenses: Expense[]): Set<string> {
  const byId = new Map(expenses.map((e) => [e.id, e]));
  const out = new Set<string>();
  for (const e of expenses) {
    const rec = e.parentId && byId.has(e.parentId) ? byId.get(e.parentId)!.recurring : e.recurring;
    if (rec) out.add(e.id);
  }
  return out;
}

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

  // Copia os fixos do mês-fonte com ids NOVOS. Como um gasto pode estar DENTRO de outro (fatura,
  // via parentId), remapeamos o vínculo pros ids do novo mês: 1º atribui os ids, depois liga o
  // filho ao PAI já recriado. Se o pai não recorreu (não veio junto), o filho vira avulso (não
  // deixa parentId "pendurado" apontando pro mês antigo → evitaria dupla contagem).
  const srcMonth = expenses.filter((e) => e.month === src);
  const eff = effectiveRecurringIds(srcMonth); // fatura recorrente arrasta os filhos junto
  const srcExp = srcMonth.filter((e) => eff.has(e.id));
  const idMap = new Map<string, string>();
  for (const e of srcExp) idMap.set(e.id, newId());
  return {
    // Mantém `dueDay` (a conta recorre), mas zera `paid` — o vencimento do novo mês é em aberto.
    expenses: srcExp.map((e) => ({
      ...e,
      id: idMap.get(e.id)!,
      month: target,
      paid: false,
      parentId: e.parentId ? idMap.get(e.parentId) : undefined,
    })),
    incomes: incomes
      .filter((i) => i.month === src && i.recurring)
      .map((i) => ({ ...i, id: newId(), month: target })),
  };
}
