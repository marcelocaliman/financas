import { describe, it, expect } from "vitest";
import {
  computeCarneLeaoMonthly,
  computeRedutorMensal,
  computeLateFee,
} from "@/lib/financial/irpf-monthly-table";

describe("computeLateFee — multa e juros de mora (Lei 9.430/96 art. 61)", () => {
  it("em dia (daysLate ≤ 0) → sem multa/juros", () => {
    expect(computeLateFee({ principal: 1000, daysLate: 0 })).toEqual({ multa: 0, juros: 0, total: 1000 });
  });
  it("multa 0,33%/dia: 10 dias → 3,3% de 1000 = 33", () => {
    const r = computeLateFee({ principal: 1000, daysLate: 10 });
    expect(r.multa).toBeCloseTo(33, 2);
    expect(r.juros).toBe(0); // sem SELIC informada
    expect(r.total).toBeCloseTo(1033, 2);
  });
  it("multa tem teto de 20% (atraso longo)", () => {
    const r = computeLateFee({ principal: 1000, daysLate: 200 });
    expect(r.multa).toBe(200); // 0,33%×200 = 66% → capado em 20%
  });
  it("juros = SELIC acumulada + 1% no mês do pagamento", () => {
    const r = computeLateFee({ principal: 1000, daysLate: 40, selicAccumulated: 0.025 });
    expect(r.juros).toBeCloseTo(35, 2); // (2,5% + 1%) × 1000
  });
});

describe("computeCarneLeaoMonthly — vencimento recua feriado", () => {
  it("competência abr/2018 → DARF de mai/2018 recua Corpus Christi (31/05) pra 30/05", () => {
    // Corpus Christi 2018 = 31/05 (quinta). Último dia útil de maio vira 30/05.
    const r = computeCarneLeaoMonthly({ grossIncome: 10000, competenceDate: "2018-04-20" });
    expect(r.darfDueDate).toBe("2018-05-30");
  });
  it("competência jan/2026 → DARF de fev recua sábado 28/02 pra 27/02", () => {
    const r = computeCarneLeaoMonthly({ grossIncome: 10000, competenceDate: "2026-01-10" });
    expect(r.darfDueDate).toBe("2026-02-27");
  });
});

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

describe("Redutor mensal Lei 15.270/25 (ano-base 2026+)", () => {
  it("year < 2026 → redutor zero (lei ainda não em vigor)", () => {
    expect(computeRedutorMensal(2025, 6000)).toBe(0);
    expect(computeRedutorMensal(2024, 4000)).toBe(0);
  });

  it("renda ≤ R$ 5.000 → redutor fixo R$ 312,89", () => {
    expect(computeRedutorMensal(2026, 1000)).toBe(312.89);
    expect(computeRedutorMensal(2026, 4500)).toBe(312.89);
    expect(computeRedutorMensal(2026, 5000)).toBe(312.89);
  });

  it("renda na zona de transição → fórmula 978,62 − 0,133145 × renda", () => {
    // R$ 6.000: 978,62 − 0,133145 × 6.000 = 978,62 − 798,87 = R$ 179,75
    expect(computeRedutorMensal(2026, 6000)).toBeCloseTo(179.75, 2);
    // R$ 7.000: 978,62 − 0,133145 × 7.000 = 978,62 − 932,015 = R$ 46,605
    expect(computeRedutorMensal(2026, 7000)).toBeCloseTo(46.61, 1);
  });

  it("renda ≥ R$ 7.350 → redutor zero", () => {
    expect(computeRedutorMensal(2026, 7350)).toBe(0);
    expect(computeRedutorMensal(2026, 10000)).toBe(0);
    expect(computeRedutorMensal(2026, 50000)).toBe(0);
  });

  it("Aline R$ 6.000 brutos: imposto líquido R$ 395,61", () => {
    const r = computeCarneLeaoMonthly({
      grossIncome: 6000,
      deductibleExpenses: 649.59, // INSS 2025
      competenceDate: "2026-04-15",
      year: 2026,
    });
    // Base: 6000 - 649.59 = 5350.41. Faixa 27.5%: 5350.41 × 0.275 − 896 = 575.36
    // Redutor: R$ 179,75. Líquido: 575,36 − 179,75 = R$ 395,61
    expect(r.taxDue).toBeCloseTo(395.61, 1);
  });
});
