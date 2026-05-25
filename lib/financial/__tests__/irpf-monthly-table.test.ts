import { describe, it, expect } from "vitest";
import { computeCarneLeaoMonthly } from "@/lib/financial/irpf-monthly-table";

describe("computeCarneLeaoMonthly", () => {
  it("renda < isenção → imposto zero", () => {
    const r = computeCarneLeaoMonthly({
      grossIncome: 2000,
      competenceDate: "2026-04-15",
    });
    expect(r.taxDue).toBe(0);
    expect(r.bracketDescription).toBe("Isenta");
  });

  it("renda na faixa 7.5%", () => {
    const r = computeCarneLeaoMonthly({
      grossIncome: 2500,
      competenceDate: "2026-04-15",
    });
    // 2500 * 0.075 - 169.44 = 187.5 - 169.44 = 18.06
    expect(r.taxDue).toBeCloseTo(18.06, 2);
    expect(r.rate).toBe(0.075);
  });

  it("renda na faixa 27.5% (mais alta)", () => {
    const r = computeCarneLeaoMonthly({
      grossIncome: 10000,
      competenceDate: "2026-04-15",
    });
    // 10000 * 0.275 - 896 = 2750 - 896 = 1854
    expect(r.taxDue).toBe(1854);
    expect(r.rate).toBe(0.275);
  });

  it("deduções reduzem a base", () => {
    const r = computeCarneLeaoMonthly({
      grossIncome: 5000,
      deductibleExpenses: 500,
      numDependents: 2,
      competenceDate: "2026-04-15",
    });
    // base = 5000 - 500 - 2*189.59 = 4120.82
    expect(r.taxableBase).toBeCloseTo(4120.82, 2);
    // faixa 22.5%: 4120.82*0.225 - 662.77 = 927.18 - 662.77 = 264.41
    expect(r.taxDue).toBeCloseTo(264.42, 1);
  });

  it("DARF vence no último dia útil do mês seguinte", () => {
    // Maio/2026: dia 31/05 é domingo, recua pra sexta 29/05
    const r = computeCarneLeaoMonthly({
      grossIncome: 3000,
      competenceDate: "2026-04-15",
    });
    expect(r.darfDueDate).toBe("2026-05-29");
  });

  it("renda exatamente na borda de faixa não dispara próxima", () => {
    const r = computeCarneLeaoMonthly({
      grossIncome: 2259.20,
      competenceDate: "2026-04-15",
    });
    expect(r.rate).toBe(0);
    expect(r.taxDue).toBe(0);
  });
});
