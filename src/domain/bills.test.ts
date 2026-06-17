import { describe, it, expect } from "vitest";
import { billDueDate, daysBetween, daysInMonth, classifyBill, upcomingBills } from "./bills";
import type { Expense } from "@/domain/types";

let n = 0;
const exp = (p: Partial<Expense>): Expense => ({
  id: p.id ?? `e${++n}`,
  month: p.month ?? "2026-06",
  categoryId: p.categoryId ?? "moradia",
  name: p.name ?? "Conta",
  currency: p.currency ?? "BRL",
  amount: p.amount ?? 100,
  dueDay: p.dueDay,
  paid: p.paid,
});

describe("daysInMonth / billDueDate", () => {
  it("fevereiro 2026 tem 28 dias; dia 31 vira 28", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(billDueDate("2026-02", 31)).toBe("2026-02-28");
  });
  it("ano bissexto: fevereiro 2024 tem 29", () => {
    expect(billDueDate("2024-02", 31)).toBe("2024-02-29");
  });
  it("dia normal é zero-padded", () => {
    expect(billDueDate("2026-06", 5)).toBe("2026-06-05");
  });
});

describe("daysBetween", () => {
  it("conta dias inteiros due − today", () => {
    expect(daysBetween("2026-06-10", "2026-06-15")).toBe(5);
    expect(daysBetween("2026-06-15", "2026-06-10")).toBe(-5);
    expect(daysBetween("2026-06-15", "2026-06-15")).toBe(0);
  });
  it("atravessa o mês corretamente", () => {
    expect(daysBetween("2026-06-28", "2026-07-03")).toBe(5);
  });
});

describe("classifyBill", () => {
  it("classifica por dias restantes", () => {
    expect(classifyBill(-1)).toBe("overdue");
    expect(classifyBill(0)).toBe("today");
    expect(classifyBill(3)).toBe("soon");
    expect(classifyBill(4)).toBe("later");
  });
});

describe("upcomingBills", () => {
  const today = "2026-06-15";

  it("inclui só contas com vencimento e não pagas", () => {
    const rows = [
      exp({ id: "a", month: "2026-06", dueDay: 20 }), // a vencer
      exp({ id: "b", month: "2026-06", dueDay: 10, paid: true }), // paga → fora
      exp({ id: "c", month: "2026-06" }), // sem dueDay → fora
    ];
    const bills = upcomingBills(rows, today);
    expect(bills.map((b) => b.id)).toEqual(["a"]);
  });

  it("ordena por data e marca atrasadas/hoje/em breve", () => {
    const rows = [
      exp({ id: "soon", month: "2026-06", dueDay: 17 }),
      exp({ id: "overdue", month: "2026-06", dueDay: 10 }),
      exp({ id: "today", month: "2026-06", dueDay: 15 }),
    ];
    const bills = upcomingBills(rows, today);
    expect(bills.map((b) => b.id)).toEqual(["overdue", "today", "soon"]);
    expect(bills.map((b) => b.status)).toEqual(["overdue", "today", "soon"]);
    expect(bills.find((b) => b.id === "overdue")!.daysUntil).toBe(-5);
  });

  it("respeita a janela (futuro e passado)", () => {
    const rows = [
      exp({ id: "far", month: "2026-09", dueDay: 1 }), // ~78 dias → fora (>45)
      exp({ id: "old", month: "2026-02", dueDay: 1 }), // ~134 dias atrás → fora (<-90)
      exp({ id: "in", month: "2026-07", dueDay: 10 }), // ~25 dias → dentro
    ];
    const bills = upcomingBills(rows, today);
    expect(bills.map((b) => b.id)).toEqual(["in"]);
  });
});
