import { describe, it, expect } from "vitest";
import {
  computeCarneLeaoTax,
  calcMonthlyTax,
  lastBusinessDayOfNextMonth,
} from "@/services/ir/carne-leao";

describe("calcMonthlyTax — tabela progressiva mensal", () => {
  describe("Maio/2024 em diante (tabela MP 1.171)", () => {
    it("isento até R$ 2.259,20", () => {
      expect(calcMonthlyTax(2000, 2024, 5)).toBe(0);
      expect(calcMonthlyTax(2259.20, 2024, 5)).toBe(0);
    });

    it("faixa 7,5% — R$ 2.500", () => {
      // 2500 * 0.075 - 169.44 = 187.50 - 169.44 = 18.06
      expect(calcMonthlyTax(2500, 2024, 5)).toBeCloseTo(18.06, 2);
    });

    it("faixa 15% — R$ 3.000", () => {
      // 3000 * 0.15 - 381.44 = 450 - 381.44 = 68.56
      expect(calcMonthlyTax(3000, 2024, 5)).toBeCloseTo(68.56, 2);
    });

    it("faixa 22,5% — R$ 4.000", () => {
      // 4000 * 0.225 - 662.77 = 900 - 662.77 = 237.23
      expect(calcMonthlyTax(4000, 2024, 5)).toBeCloseTo(237.23, 2);
    });

    it("faixa 27,5% — R$ 8.000", () => {
      // 8000 * 0.275 - 896.00 = 2200 - 896 = 1304
      expect(calcMonthlyTax(8000, 2024, 5)).toBeCloseTo(1304.00, 2);
    });
  });

  describe("Jan-Abr/2024 (tabela antiga)", () => {
    it("isento até R$ 2.112", () => {
      expect(calcMonthlyTax(2000, 2024, 3)).toBe(0);
      expect(calcMonthlyTax(2112.00, 2024, 3)).toBe(0);
    });

    it("R$ 2.500 — usa tabela velha (isento até 2.112)", () => {
      // 2500 * 0.075 - 158.40 = 187.50 - 158.40 = 29.10
      expect(calcMonthlyTax(2500, 2024, 3)).toBeCloseTo(29.10, 2);
    });

    it("tabela diferente entre abril e maio do mesmo ano", () => {
      const aprilTax = calcMonthlyTax(2500, 2024, 4);
      const mayTax = calcMonthlyTax(2500, 2024, 5);
      expect(aprilTax).not.toBe(mayTax);
      expect(aprilTax).toBeGreaterThan(mayTax); // tabela velha gera mais imposto
    });
  });

  it("2025 e adiante: usa tabela atual", () => {
    expect(calcMonthlyTax(2500, 2025, 6)).toBeCloseTo(18.06, 2);
  });
});

describe("computeCarneLeaoTax", () => {
  it("aluguel R$ 3.000 sem dedução → ~R$ 68,56 (2024 maio)", () => {
    const r = computeCarneLeaoTax({
      grossAmount: 3000,
      deductibleExpenses: 0,
      year: 2024,
      month: 5,
    });
    expect(r.taxableBase).toBe(3000);
    expect(r.taxDue).toBeCloseTo(68.56, 2);
  });

  it("aluguel R$ 3.000 com condomínio R$ 500 → base R$ 2.500 → R$ 18,06", () => {
    const r = computeCarneLeaoTax({
      grossAmount: 3000,
      deductibleExpenses: 500,
      year: 2024,
      month: 5,
    });
    expect(r.taxableBase).toBe(2500);
    expect(r.taxDue).toBeCloseTo(18.06, 2);
  });

  it("dependente reduz base", () => {
    const r = computeCarneLeaoTax({
      grossAmount: 3000,
      deductibleExpenses: 0,
      dependentDeduction: 189.59,
      year: 2024,
      month: 5,
    });
    expect(r.taxableBase).toBe(2810.41);
  });

  it("base zera quando deduções > rendimento", () => {
    const r = computeCarneLeaoTax({
      grossAmount: 1000,
      deductibleExpenses: 2000,
      year: 2024,
      month: 5,
    });
    expect(r.taxableBase).toBe(0);
    expect(r.taxDue).toBe(0);
  });
});

describe("lastBusinessDayOfNextMonth", () => {
  it("Janeiro → último dia útil de fevereiro", () => {
    // Fev/2025 termina dia 28 (sexta). Último útil = 28.
    expect(lastBusinessDayOfNextMonth(2025, 1)).toBe("2025-02-28");
  });

  it("Maio → último dia útil de junho", () => {
    // Jun/2025 termina dia 30 (segunda). Último útil = 30.
    expect(lastBusinessDayOfNextMonth(2025, 5)).toBe("2025-06-30");
  });

  it("Dezembro → último dia útil de janeiro do ano seguinte", () => {
    // Jan/2026 termina dia 31 (sábado) → recua pro 30 (sexta)
    expect(lastBusinessDayOfNextMonth(2025, 12)).toBe("2026-01-30");
  });

  it("Recua quando último dia cai no fim de semana", () => {
    // Ago/2025 termina dia 31 (domingo) → recua pro 29 (sexta)
    expect(lastBusinessDayOfNextMonth(2025, 7)).toBe("2025-08-29");
  });
});
