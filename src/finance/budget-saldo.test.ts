import { describe, it, expect } from "vitest";
import type { RateTable } from "@/money/currency";
import type { Expense, Income } from "@/domain/types";
import { budgetSaldoForMonth } from "./budget-saldo";

const RATES: RateTable = { BRL: 1, EUR: 6, USD: 5, GBP: 7 };
const exp = (o: Partial<Expense>): Expense => ({ id: "e", month: "2026-07", categoryId: "cat", name: "", currency: "BRL", amount: 0, ...o });
const inc = (o: Partial<Income>): Income => ({ id: "i", month: "2026-07", categoryId: "salario", name: "", currency: "BRL", amount: 0, ...o });

describe("budgetSaldoForMonth — ponte orçamento → aporte do Histórico/snapshot", () => {
  it("mês sem NENHUM lançamento → null (nunca sugerir aporte falso de R$ 0)", () => {
    expect(budgetSaldoForMonth("2026-07", { incomes: [], expenses: [] }, "BRL", RATES)).toBeNull();
    // lançamentos existem, mas de OUTRO mês → continua null
    const budget = { incomes: [inc({ month: "2026-06", amount: 100 })], expenses: [exp({ month: "2026-06", amount: 50 })] };
    expect(budgetSaldoForMonth("2026-07", budget, "BRL", RATES)).toBeNull();
  });

  it("orçamento ausente (null/undefined) → null", () => {
    expect(budgetSaldoForMonth("2026-07", null, "BRL", RATES)).toBeNull();
    expect(budgetSaldoForMonth("2026-07", undefined, "BRL", RATES)).toBeNull();
  });

  it("saldo simples = receitas − gastos do mês", () => {
    const budget = { incomes: [inc({ amount: 5000 })], expenses: [exp({ amount: 3200 })] };
    expect(budgetSaldoForMonth("2026-07", budget, "BRL", RATES)).toBeCloseTo(1800, 4);
  });

  it("mix de moedas converte pra moeda pedida (receita EUR + gasto USD → BRL)", () => {
    const budget = {
      incomes: [inc({ amount: 1000, currency: "EUR" })], // 6000 BRL
      expenses: [exp({ amount: 200, currency: "USD" })], // 1000 BRL
    };
    expect(budgetSaldoForMonth("2026-07", budget, "BRL", RATES)).toBeCloseTo(5000, 4);
    // e na direção inversa: pedir em EUR
    expect(budgetSaldoForMonth("2026-07", budget, "EUR", RATES)).toBeCloseTo(5000 / 6, 4);
  });

  it("saldo negativo é válido (desinvestimento), não vira null", () => {
    const budget = { incomes: [inc({ amount: 1000 })], expenses: [exp({ amount: 1500 })] };
    expect(budgetSaldoForMonth("2026-07", budget, "BRL", RATES)).toBeCloseTo(-500, 4);
  });

  it("só receita (sem gasto) e só gasto (sem receita) contam", () => {
    expect(budgetSaldoForMonth("2026-07", { incomes: [inc({ amount: 800 })], expenses: [] }, "BRL", RATES)).toBeCloseTo(800, 4);
    expect(budgetSaldoForMonth("2026-07", { incomes: [], expenses: [exp({ amount: 300 })] }, "BRL", RATES)).toBeCloseTo(-300, 4);
  });

  it("anti dupla-contagem: item DENTRO da fatura (parentId) não soma de novo", () => {
    const budget = {
      incomes: [inc({ amount: 10000 })],
      expenses: [
        exp({ id: "card", amount: 4000 }), // fatura
        exp({ id: "filho", parentId: "card", amount: 1500 }), // já está nos 4000
        exp({ id: "avulso", amount: 500 }),
      ],
    };
    // 10000 − (4000 + 500) — o filho NÃO entra
    expect(budgetSaldoForMonth("2026-07", budget, "BRL", RATES)).toBeCloseTo(5500, 4);
  });

  it("órfão (parentId de fatura que não existe no mês) volta a contar como avulso", () => {
    const budget = {
      incomes: [inc({ amount: 1000 })],
      expenses: [exp({ id: "orfao", parentId: "fatura-apagada", amount: 400 })],
    };
    expect(budgetSaldoForMonth("2026-07", budget, "BRL", RATES)).toBeCloseTo(600, 4);
  });
});
