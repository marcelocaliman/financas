import { describe, it, expect } from "vitest";
import { fireNumber, realReturn, safeMonthlyIncome, yearsToFI } from "./fire";
import { projectBalance } from "./projection";

describe("fireNumber", () => {
  it("é 25× os gastos anuais à taxa de 4%", () => {
    expect(fireNumber(40000, 4)).toBe(1_000_000);
  });
  it("escala com a taxa de retirada (3% → ~33×)", () => {
    expect(fireNumber(30000, 3)).toBeCloseTo(1_000_000, 6);
  });
  it("gastos zero → alvo zero", () => {
    expect(fireNumber(0, 4)).toBe(0);
  });
  it("taxa não-positiva → inalcançável (Infinity)", () => {
    expect(fireNumber(40000, 0)).toBe(Infinity);
  });
});

describe("realReturn", () => {
  it("desconta a inflação (8% nominal, 4% inflação ≈ 3.85% real)", () => {
    expect(realReturn(8, 4)).toBeCloseTo(0.0385, 4);
  });
  it("retorno = inflação → real 0", () => {
    expect(realReturn(5, 5)).toBeCloseTo(0, 12);
  });
});

describe("safeMonthlyIncome", () => {
  it("4% de 1.2M / 12 = 4000/mês", () => {
    expect(safeMonthlyIncome(1_200_000, 4)).toBeCloseTo(4000, 6);
  });
  it("patrimônio negativo → 0", () => {
    expect(safeMonthlyIncome(-100, 4)).toBe(0);
  });
});

describe("yearsToFI", () => {
  it("já atingiu → 0", () => {
    expect(yearsToFI({ portfolio: 1_000_000, monthlyContribution: 1000, realAnnualReturn: 0.04, target: 800_000 })).toBe(0);
  });

  it("retorno real 0: anos = (alvo − atual)/aporte (linear)", () => {
    const y = yearsToFI({ portfolio: 0, monthlyContribution: 1000, realAnnualReturn: 0, target: 120_000 });
    expect(y).toBeCloseTo(10, 9); // 120 meses
  });

  it("estagnado (sem juro nem aporte) abaixo do alvo → null", () => {
    expect(yearsToFI({ portfolio: 100, monthlyContribution: 0, realAnnualReturn: 0, target: 1000 })).toBeNull();
  });

  it("é o INVERSO de projectBalance ao retorno real (consistência)", () => {
    const params = { portfolio: 50_000, monthlyContribution: 1500, realAnnualReturn: 0.04, target: 600_000 };
    const y = yearsToFI(params)!;
    expect(y).toBeGreaterThan(0);
    // recolocando os anos na projeção (mesmo retorno real), o saldo bate no alvo
    const bal = projectBalance(params.portfolio, params.monthlyContribution, params.realAnnualReturn, y);
    expect(bal).toBeCloseTo(params.target, 0);
  });

  it("com retorno positivo, qualquer alvo finito é alcançável (> 0)", () => {
    const y = yearsToFI({ portfolio: 1000, monthlyContribution: 0, realAnnualReturn: 0.05, target: 1_000_000 });
    expect(y).not.toBeNull();
    expect(y!).toBeGreaterThan(0);
  });

  it("retorno real negativo com teto abaixo do alvo → null", () => {
    // teto ≈ aporte/|i|; aporte baixo + decaimento → não chega a 10M
    const y = yearsToFI({ portfolio: 1000, monthlyContribution: 100, realAnnualReturn: -0.05, target: 10_000_000 });
    expect(y).toBeNull();
  });
});
