import type { Currency } from "@/money/currency";
import type { Expense } from "@/domain/types";
import { topLevelExpenses } from "@/finance/statement";

/**
 * Contas a pagar / vencimentos (lógica PURA e testável).
 *
 * Uma CONTA é um gasto com `dueDay` (dia 1–31). O vencimento é `mês + dia` (dia limitado
 * ao tamanho do mês). "Próximos vencimentos" = contas não pagas dentro de uma janela
 * (atrasadas recentes + a vencer em breve), ordenadas pela data.
 */
export type BillStatus = "overdue" | "today" | "soon" | "later";

export interface UpcomingBill {
  id: string;
  name: string;
  categoryId: string;
  month: string;
  currency: Currency;
  amount: number;
  dueDate: string; // "AAAA-MM-DD"
  daysUntil: number; // negativo = atrasada
  status: BillStatus;
}

/** Nº de dias do mês (month1 = 1–12). */
export function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate();
}

/** Data de vencimento "AAAA-MM-DD" (dia preso ao tamanho do mês: 31 em fevereiro → 28/29). */
export function billDueDate(month: string, dueDay: number): string {
  const [y, m] = month.split("-").map(Number);
  const day = Math.min(Math.max(1, Math.round(dueDay)), daysInMonth(y, m));
  return `${month}-${String(day).padStart(2, "0")}`;
}

/** Diferença em dias inteiros (due − today), ambos "AAAA-MM-DD", no horário local. */
export function daysBetween(todayISO: string, dueISO: string): number {
  const [ay, am, ad] = todayISO.split("-").map(Number);
  const [by, bm, bd] = dueISO.split("-").map(Number);
  const a = new Date(ay, am - 1, ad).getTime();
  const b = new Date(by, bm - 1, bd).getTime();
  return Math.round((b - a) / 86400000);
}

export function classifyBill(daysUntil: number, soonDays = 3): BillStatus {
  if (daysUntil < 0) return "overdue";
  if (daysUntil === 0) return "today";
  if (daysUntil <= soonDays) return "soon";
  return "later";
}

/**
 * Contas não pagas (com vencimento) na janela: atrasadas até `pastDays` dias e a vencer
 * em até `futureDays` dias. Ordenadas pela data de vencimento (mais cedo primeiro).
 */
export function upcomingBills(
  expenses: Expense[],
  todayISO: string,
  futureDays = 45,
  pastDays = 90,
): UpcomingBill[] {
  const out: UpcomingBill[] = [];
  // A CONTA é a fatura (top-level); os itens DENTRO dela não são contas separadas.
  for (const e of topLevelExpenses(expenses)) {
    if (e.dueDay == null || e.paid) continue;
    const dueDate = billDueDate(e.month, e.dueDay);
    const daysUntil = daysBetween(todayISO, dueDate);
    if (daysUntil > futureDays || daysUntil < -pastDays) continue;
    out.push({
      id: e.id,
      name: e.name,
      categoryId: e.categoryId,
      month: e.month,
      currency: e.currency,
      amount: e.amount,
      dueDate,
      daysUntil,
      status: classifyBill(daysUntil),
    });
  }
  return out.sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
}
