import { describe, it, expect } from "vitest";
import {
  computeFire,
  computeMonthsToFire,
  annualToMonthlyRate,
  simulateScenarios,
} from "@/lib/financial/fire";

/**
 * Testes do motor de cálculo FIRE.
 *
 * Coberturas:
 *   - SWR → patrimônio alvo (4% → 25× renda anual)
 *   - Juros compostos: meses pra atingir target
 *   - Casos especiais: r=0 (linear), aporte=0 (só juros), já atingido
 *   - INSS reduz target da carteira
 *   - Classificação por estado do patrimônio
 */

describe("computeFire — patrimônio alvo (SWR)", () => {
  it("SWR 4% → target = 25× renda anual", () => {
    const r = computeFire({
      currentNetWorth: 0,
      monthlyAddition: 0,
      targetMonthlyIncome: 10000,
      realAnnualReturnPct: 6,
      swrPct: 4,
    });
    // 10k/mês × 12 = 120k/ano. Target = 120k / 0.04 = 3.000.000
    expect(r.fireTargetNetWorth).toBeCloseTo(3_000_000, 2);
    expect(r.netTargetAnnualIncome).toBe(120000);
  });

  it("SWR 3.5% → mais conservador, exige mais patrimônio", () => {
    const r = computeFire({
      currentNetWorth: 0,
      monthlyAddition: 0,
      targetMonthlyIncome: 10000,
      realAnnualReturnPct: 6,
      swrPct: 3.5,
    });
    // 120k / 0.035 ≈ 3.428.571,43
    expect(r.fireTargetNetWorth).toBeCloseTo(3_428_571.43, 1);
  });

  it("INSS reduz o que a carteira precisa cobrir", () => {
    const r = computeFire({
      currentNetWorth: 0,
      monthlyAddition: 0,
      targetMonthlyIncome: 10000,
      realAnnualReturnPct: 6,
      swrPct: 4,
      inssMonthlyEstimate: 3000,
    });
    // 7k/mês × 12 = 84k. Target = 84k / 0.04 = 2.100.000
    expect(r.fireTargetNetWorth).toBeCloseTo(2_100_000, 2);
    expect(r.netTargetMonthlyIncome).toBe(7000);
  });
});

describe("computeMonthsToFire — casos especiais", () => {
  it("já atingiu → 0 meses", () => {
    const n = computeMonthsToFire({
      currentNetWorth: 4_000_000,
      targetNetWorth: 3_000_000,
      monthlyAddition: 0,
      realAnnualReturnPct: 6,
    });
    expect(n).toBe(0);
  });

  it("r=0 e PMT=0 → impossível (null)", () => {
    const n = computeMonthsToFire({
      currentNetWorth: 100_000,
      targetNetWorth: 1_000_000,
      monthlyAddition: 0,
      realAnnualReturnPct: 0,
    });
    expect(n).toBeNull();
  });

  it("r=0, com aporte → linear", () => {
    const n = computeMonthsToFire({
      currentNetWorth: 100_000,
      targetNetWorth: 1_000_000,
      monthlyAddition: 10_000,
      realAnnualReturnPct: 0,
    });
    // (1M - 100k) / 10k = 90 meses
    expect(n).toBeCloseTo(90, 1);
  });

  it("r>0 sem aporte (Coast FIRE puro)", () => {
    const n = computeMonthsToFire({
      currentNetWorth: 500_000,
      targetNetWorth: 1_000_000,
      monthlyAddition: 0,
      realAnnualReturnPct: 6,
    });
    // 500k → 1M @ 6% real a.a. = ln(2)/ln(1+r_mensal)
    // r_mensal = 1.06^(1/12) - 1 ≈ 0.0048676
    // n ≈ ln(2)/ln(1.0048676) ≈ 142.75 meses (~11.9 anos)
    expect(n).toBeCloseTo(142.75, 1);
  });

  it("r=6%, aporte=5k/mês, 100k→1M → ~121 meses", () => {
    const n = computeMonthsToFire({
      currentNetWorth: 100_000,
      targetNetWorth: 1_000_000,
      monthlyAddition: 5_000,
      realAnnualReturnPct: 6,
    });
    // Fórmula PV·(1+r)^n + PMT·[(1+r)^n − 1]/r = FV
    // → ~120.87 meses (~10.1 anos)
    expect(n).toBeCloseTo(120.87, 1);
  });

  it("target infinito → null", () => {
    const n = computeMonthsToFire({
      currentNetWorth: 100_000,
      targetNetWorth: Infinity,
      monthlyAddition: 5_000,
      realAnnualReturnPct: 6,
    });
    expect(n).toBeNull();
  });
});

describe("annualToMonthlyRate", () => {
  it("6% a.a. → ~0.4868% a.m.", () => {
    expect(annualToMonthlyRate(6)).toBeCloseTo(0.004867550565343, 8);
  });
  it("12% a.a. → ~0.9489% a.m.", () => {
    expect(annualToMonthlyRate(12)).toBeCloseTo(0.0094887929, 6);
  });
  it("0% → 0", () => {
    expect(annualToMonthlyRate(0)).toBe(0);
  });
  it("negativo → 0 (não suportado)", () => {
    expect(annualToMonthlyRate(-3)).toBe(0);
  });
});

describe("computeFire — coverageRatio + classification", () => {
  it("achieved: patrimônio = target", () => {
    const r = computeFire({
      currentNetWorth: 3_000_000,
      monthlyAddition: 0,
      targetMonthlyIncome: 10000,
      realAnnualReturnPct: 6,
      swrPct: 4,
    });
    expect(r.classification).toBe("achieved");
    expect(r.coverageRatio).toBeCloseTo(1, 2);
    expect(r.gap).toBe(0);
    expect(r.monthsToFire).toBe(0);
  });

  it("fat: patrimônio > 130% do target", () => {
    const r = computeFire({
      currentNetWorth: 4_500_000,
      monthlyAddition: 0,
      targetMonthlyIncome: 10000,
      realAnnualReturnPct: 6,
      swrPct: 4,
    });
    expect(r.classification).toBe("fat");
  });

  it("building: longe do target, sem outras condições", () => {
    const r = computeFire({
      currentNetWorth: 50_000,
      monthlyAddition: 1_000,
      targetMonthlyIncome: 10_000,
      realAnnualReturnPct: 6,
      swrPct: 4,
    });
    expect(r.classification).toBe("building");
  });

  it("idade ao chegar = currentAge + yearsToFire", () => {
    const r = computeFire({
      currentNetWorth: 100_000,
      monthlyAddition: 5_000,
      targetMonthlyIncome: 10_000,
      realAnnualReturnPct: 6,
      swrPct: 4,
      currentAge: 35,
    });
    if (r.ageAtFire != null && r.yearsToFire != null) {
      expect(r.ageAtFire).toBeCloseTo(35 + r.yearsToFire, 1);
    }
  });
});

describe("simulateScenarios", () => {
  it("scenario coast zera aporte", () => {
    const base = {
      currentNetWorth: 1_000_000,
      monthlyAddition: 10_000,
      targetMonthlyIncome: 10_000,
      realAnnualReturnPct: 6,
      swrPct: 4,
    };
    const [coast] = simulateScenarios(base, [
      { label: "coast", variant: "coast", zeroOutAddition: true },
    ]);
    // Sem aporte: cresce só por juros. 1M → 3M @ 6% = ln(3)/ln(1.06_mensal)
    // r_mensal = 1.06^(1/12)-1
    // n = ln(3)/ln(1.004868) ≈ 226 meses
    expect(coast.monthsToFire).toBeCloseTo(226, 0);
  });

  it("scenario more_savings reduz prazo", () => {
    const base = {
      currentNetWorth: 100_000,
      monthlyAddition: 3_000,
      targetMonthlyIncome: 10_000,
      realAnnualReturnPct: 6,
      swrPct: 4,
    };
    const [current, doubled] = simulateScenarios(base, [
      { label: "atual", variant: "current" },
      { label: "+2k", variant: "more_savings", monthlyAdditionDelta: 2000 },
    ]);
    expect(current.monthsToFire).toBeGreaterThan(doubled.monthsToFire!);
  });
});
