import { describe, it, expect } from "vitest";
import { planRecurring } from "./recurring";
import type { Expense, Income } from "@/domain/types";

let n = 0;
const newId = () => `new-${++n}`;

const exp = (p: Partial<Expense>): Expense => ({
  id: p.id ?? `e${++n}`,
  month: p.month ?? "2026-01",
  categoryId: p.categoryId ?? "moradia",
  name: p.name ?? "",
  currency: p.currency ?? "BRL",
  amount: p.amount ?? 100,
  recurring: p.recurring,
  dueDay: p.dueDay,
  paid: p.paid,
});
const inc = (p: Partial<Income>): Income => ({
  id: p.id ?? `i${++n}`,
  month: p.month ?? "2026-01",
  categoryId: p.categoryId ?? "salario",
  name: p.name ?? "",
  currency: p.currency ?? "BRL",
  amount: p.amount ?? 1000,
  recurring: p.recurring,
});

describe("planRecurring", () => {
  it("traz os fixos do mês anterior pro mês-alvo, com ids novos e o mês-alvo", () => {
    const expenses = [
      exp({ id: "rent", month: "2026-01", amount: 2000, recurring: true }),
      exp({ id: "oneoff", month: "2026-01", amount: 50, recurring: false }),
    ];
    const incomes = [inc({ id: "sal", month: "2026-01", amount: 5000, recurring: true })];
    const plan = planRecurring(expenses, incomes, "2026-02", newId);
    expect(plan.expenses).toHaveLength(1);
    expect(plan.incomes).toHaveLength(1);
    expect(plan.expenses[0]).toMatchObject({ month: "2026-02", amount: 2000 });
    expect(plan.expenses[0].id).not.toBe("rent");
    expect(plan.incomes[0]).toMatchObject({ month: "2026-02", amount: 5000 });
    // não traz o lançamento avulso (não recorrente)
    expect(plan.expenses.find((e) => e.amount === 50)).toBeUndefined();
  });

  it("é idempotente: não traz nada se o mês-alvo já tem um fixo", () => {
    const expenses = [
      exp({ id: "rent-jan", month: "2026-01", recurring: true }),
      exp({ id: "rent-feb", month: "2026-02", recurring: true }),
    ];
    const plan = planRecurring(expenses, [], "2026-02", newId);
    expect(plan.expenses).toHaveLength(0);
    expect(plan.incomes).toHaveLength(0);
  });

  it("usa o mês com fixos MAIS RECENTE anterior ao alvo (pula buracos)", () => {
    const expenses = [
      exp({ id: "old", month: "2026-01", amount: 100, recurring: true }),
      exp({ id: "mid", month: "2026-03", amount: 300, recurring: true }),
    ];
    // alvo abril; fontes possíveis jan e mar → usa março
    const plan = planRecurring(expenses, [], "2026-04", newId);
    expect(plan.expenses).toHaveLength(1);
    expect(plan.expenses[0].amount).toBe(300);
  });

  it("não traz nada quando não há nenhum fixo anterior ao alvo", () => {
    const expenses = [exp({ month: "2026-01", recurring: false })];
    const plan = planRecurring(expenses, [], "2026-02", newId);
    expect(plan.expenses).toHaveLength(0);
  });

  it("ignora fixos de meses iguais ou posteriores ao alvo (não reescreve futuro como fonte)", () => {
    const expenses = [exp({ id: "future", month: "2026-05", recurring: true })];
    const plan = planRecurring(expenses, [], "2026-02", newId);
    expect(plan.expenses).toHaveLength(0);
  });

  it("preserva a marca recurring nas cópias (propaga adiante)", () => {
    const expenses = [exp({ month: "2026-01", recurring: true })];
    const plan = planRecurring(expenses, [], "2026-02", newId);
    expect(plan.expenses[0].recurring).toBe(true);
  });

  it("conta recorrente: mantém o dia de vencimento mas reabre como NÃO paga", () => {
    const expenses = [exp({ month: "2026-01", recurring: true, dueDay: 10, paid: true })];
    const plan = planRecurring(expenses, [], "2026-02", newId);
    expect(plan.expenses[0].dueDay).toBe(10);
    expect(plan.expenses[0].paid).toBe(false);
  });
});
