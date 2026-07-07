import { describe, it, expect } from "vitest";
import type { RateTable } from "@/money/currency";
import type { Expense } from "@/domain/types";
import { topLevelExpenses, expenseTotal, statementResidual, expenseLeaves, expenseByPerson, childrenOf, hasChildren } from "./statement";

const RATES: RateTable = { BRL: 1, EUR: 5.85, USD: 5.42, GBP: 7.1 };
const exp = (o: Partial<Expense>): Expense => ({ id: "x", month: "2026-07", categoryId: "cat", name: "", currency: "BRL", amount: 0, ...o });

const CARD = exp({ id: "card", categoryId: "cartao", name: "Cartão XP", amount: 18000 });
const CLAUDE = exp({ id: "c1", parentId: "card", categoryId: "software", name: "Claude", amount: 550 });
const AMIL = exp({ id: "c2", parentId: "card", categoryId: "saude", name: "Amil", amount: 1869 });
const ALUGUEL = exp({ id: "s1", categoryId: "moradia", name: "Aluguel", amount: 2500 });
const ALL = [CARD, CLAUDE, AMIL, ALUGUEL];

describe("statement — anti dupla-contagem", () => {
  it("topLevel exclui filhos; total conta a fatura mas não os itens dentro", () => {
    expect(topLevelExpenses(ALL).map((e) => e.id)).toEqual(["card", "s1"]);
    // fatura 18000 + aluguel 2500 = 20500 (Claude/Amil NÃO somam de novo)
    expect(expenseTotal(ALL, "BRL", RATES)).toBeCloseTo(20500, 4);
  });

  it("resíduo = fatura − Σ filhos (na moeda da fatura)", () => {
    expect(statementResidual(CARD, [CLAUDE, AMIL], RATES)).toBeCloseTo(15581, 4);
    // filho em moeda estrangeira converte
    const usdChild = exp({ id: "c3", parentId: "card", amount: 100, currency: "USD" }); // 542 BRL
    expect(statementResidual(CARD, [usdChild], RATES)).toBeCloseTo(18000 - 542, 4);
  });

  it("folhas = itens + resíduo + avulsos; a SOMA bate com o total (desmembrado, sem duplicar)", () => {
    const leaves = expenseLeaves(ALL, RATES);
    const sum = leaves.reduce((s, l) => s + l.amount, 0);
    expect(sum).toBeCloseTo(20500, 4);
    expect(leaves.map((l) => l.name).sort()).toEqual(["Aluguel", "Amil", "Cartão XP", "Claude"]); // resíduo herda o nome da fatura
    expect(leaves.find((l) => l.residual)?.amount).toBeCloseTo(15581, 4);
    // filho mantém a própria categoria; resíduo herda a da fatura
    expect(leaves.find((l) => l.name === "Claude")?.categoryId).toBe("software");
    expect(leaves.find((l) => l.residual)?.categoryId).toBe("cartao");
  });

  it("fatura totalmente itemizada → sem resíduo", () => {
    const full = [exp({ id: "p", amount: 100 }), exp({ id: "k1", parentId: "p", amount: 60 }), exp({ id: "k2", parentId: "p", amount: 40 })];
    expect(expenseLeaves(full, RATES).some((l) => l.residual)).toBe(false);
    expect(expenseTotal(full, "BRL", RATES)).toBeCloseTo(100, 4);
  });

  it("órfão (pai apagado) vira top-level — nunca some do total", () => {
    const orphan = [exp({ id: "o", parentId: "sumiu", amount: 300 })];
    expect(topLevelExpenses(orphan).map((e) => e.id)).toEqual(["o"]);
    expect(expenseTotal(orphan, "BRL", RATES)).toBeCloseTo(300, 4);
  });

  it("childrenOf / hasChildren", () => {
    expect(childrenOf(ALL, "card").map((e) => e.id)).toEqual(["c1", "c2"]);
    expect(hasChildren(ALL, "card")).toBe(true);
    expect(hasChildren(ALL, "s1")).toBe(false);
  });

  it("expenseByPerson: itens da fatura contam pela pessoa de cada um; resíduo pela pessoa da fatura", () => {
    const card = exp({ id: "card", amount: 1000, personId: "marcelo" });
    const kA = exp({ id: "kA", parentId: "card", amount: 200, personId: "marcelo" });
    const kB = exp({ id: "kB", parentId: "card", amount: 300, personId: "ana" });
    const solo = exp({ id: "solo", amount: 400, personId: "ana" });
    const shared = exp({ id: "sh", amount: 150 }); // sem pessoa
    const byP = expenseByPerson([card, kA, kB, solo, shared], "BRL", RATES);
    // marcelo: kA 200 + resíduo (1000−500=500) = 700; ana: kB 300 + solo 400 = 700; "" (casa): 150
    expect(byP.marcelo).toBeCloseTo(700, 4);
    expect(byP.ana).toBeCloseTo(700, 4);
    expect(byP[""]).toBeCloseTo(150, 4);
    // soma das pessoas = total top-level (fatura 1000 + solo 400 + shared 150)
    const total = Object.values(byP).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(expenseTotal([card, kA, kB, solo, shared], "BRL", RATES), 4);
  });
});
