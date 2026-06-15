import { describe, it, expect } from "vitest";
import {
  monthlyRate,
  projectBalance,
  realValue,
  projectionSeries,
} from "./projection";

describe("monthlyRate", () => {
  it("compõe 12 vezes de volta no retorno anual", () => {
    const i = monthlyRate(0.1);
    expect(Math.pow(1 + i, 12) - 1).toBeCloseTo(0.1, 10);
  });
  it("é 0 quando o retorno anual é 0", () => {
    expect(monthlyRate(0)).toBe(0);
  });
});

describe("projectBalance", () => {
  it("t=0 retorna o inicial", () => {
    expect(projectBalance(1000, 100, 0.1, 0)).toBeCloseTo(1000, 10);
  });

  it("sem retorno: inicial + aportes acumulados", () => {
    // 1000 + 100×12×5 = 7000
    expect(projectBalance(1000, 100, 0, 5)).toBeCloseTo(7000, 10);
  });

  it("bate com a fórmula FV (inicial composto + anuidade dos aportes)", () => {
    const i = monthlyRate(0.1);
    const n = 12 * 3;
    const expected = 5000 * Math.pow(1 + i, n) + 200 * ((Math.pow(1 + i, n) - 1) / i);
    expect(projectBalance(5000, 200, 0.1, 3)).toBeCloseTo(expected, 6);
  });

  it("cresce com retorno positivo vs sem retorno", () => {
    expect(projectBalance(1000, 100, 0.1, 10)).toBeGreaterThan(
      projectBalance(1000, 100, 0, 10),
    );
  });
});

describe("realValue", () => {
  it("desconta a inflação ao longo dos anos", () => {
    expect(realValue(1000, 0.05, 0)).toBeCloseTo(1000, 10);
    expect(realValue(1000, 0.05, 1)).toBeCloseTo(1000 / 1.05, 10);
  });
});

describe("projectionSeries", () => {
  it("gera years+1 pontos, do ano 0 ao ano N", () => {
    const s = projectionSeries({
      initial: 1000,
      monthlyContribution: 100,
      annualReturn: 0.08,
      annualInflation: 0.04,
      years: 5,
    });
    expect(s).toHaveLength(6);
    expect(s[0]).toMatchObject({ year: 0 });
    expect(s[5].year).toBe(5);
    // real <= nominal quando há inflação
    expect(s[5].real).toBeLessThan(s[5].nominal);
  });
});
