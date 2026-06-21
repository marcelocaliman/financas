import { describe, it, expect } from "vitest";
import {
  mulberry32,
  gaussianSampler,
  percentile,
  simulateAccumulation,
  simulateDecumulation,
} from "./montecarlo";
import { projectBalance } from "./projection";

describe("mulberry32", () => {
  it("é determinístico: mesma seed → mesma sequência", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = [a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("gera valores em [0,1) e seeds diferentes divergem", () => {
    const r = mulberry32(1);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(mulberry32(1)()).not.toEqual(mulberry32(2)());
  });
});

describe("gaussianSampler", () => {
  it("tem média ≈ 0 e desvio ≈ 1 sobre muitas amostras", () => {
    const next = gaussianSampler(mulberry32(7));
    const n = 50000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const z = next();
      sum += z;
      sumSq += z * z;
    }
    const mean = sum / n;
    const std = Math.sqrt(sumSq / n - mean * mean);
    expect(Math.abs(mean)).toBeLessThan(0.03);
    expect(Math.abs(std - 1)).toBeLessThan(0.03);
  });
});

describe("percentile", () => {
  it("extremos e mediana de uma lista ordenada", () => {
    const xs = [0, 10, 20, 30, 40];
    expect(percentile(xs, 0)).toBe(0);
    expect(percentile(xs, 1)).toBe(40);
    expect(percentile(xs, 0.5)).toBe(20);
  });
  it("interpola entre pontos", () => {
    expect(percentile([0, 100], 0.1)).toBeCloseTo(10, 6);
  });
  it("lista vazia → 0", () => {
    expect(percentile([], 0.5)).toBe(0);
  });
});

describe("simulateAccumulation", () => {
  const base = {
    initial: 100000,
    monthlyContribution: 1000,
    realAnnualReturn: 0.05,
    years: 20,
    target: 500000,
  };

  it("com volatilidade ZERO, a mediana = projeção determinística (cross-check com projectBalance)", () => {
    const res = simulateAccumulation({ ...base, annualVolatility: 0, trials: 50 });
    const deterministic = projectBalance(base.initial, base.monthlyContribution, base.realAnnualReturn, base.years);
    const finalBand = res.bands[res.bands.length - 1];
    expect(finalBand.p50).toBeCloseTo(deterministic, 2);
    expect(finalBand.p10).toBeCloseTo(deterministic, 2); // sem variância, todas as trajetórias iguais
    expect(finalBand.p90).toBeCloseTo(deterministic, 2);
  });

  it("com vol zero a probabilidade é degenerada (0 ou 1) conforme bate o alvo", () => {
    const deterministic = projectBalance(base.initial, base.monthlyContribution, base.realAnnualReturn, base.years);
    const hit = simulateAccumulation({ ...base, target: deterministic - 1, annualVolatility: 0, trials: 100 });
    const miss = simulateAccumulation({ ...base, target: deterministic + 1, annualVolatility: 0, trials: 100 });
    expect(hit.successProb).toBe(1);
    expect(miss.successProb).toBe(0);
  });

  it("é reprodutível: mesma entrada → mesma successProb", () => {
    const a = simulateAccumulation({ ...base, annualVolatility: 0.15, trials: 2000 });
    const b = simulateAccumulation({ ...base, annualVolatility: 0.15, trials: 2000 });
    expect(a.successProb).toBe(b.successProb);
  });

  it("successProb fica em [0,1] e bandas são ordenadas p10 ≤ p50 ≤ p90", () => {
    const res = simulateAccumulation({ ...base, annualVolatility: 0.15, trials: 2000 });
    expect(res.successProb).toBeGreaterThanOrEqual(0);
    expect(res.successProb).toBeLessThanOrEqual(1);
    for (const b of res.bands) {
      expect(b.p10).toBeLessThanOrEqual(b.p50);
      expect(b.p50).toBeLessThanOrEqual(b.p90);
    }
    expect(res.bands).toHaveLength(base.years + 1);
    expect(res.bands[0].p50).toBeCloseTo(base.initial, 6); // ano 0 = inicial
  });

  it("mais volatilidade alarga a banda final (P90−P10 cresce)", () => {
    const low = simulateAccumulation({ ...base, annualVolatility: 0.05, trials: 3000 });
    const high = simulateAccumulation({ ...base, annualVolatility: 0.25, trials: 3000 });
    const span = (r: typeof low) => {
      const f = r.bands[r.bands.length - 1];
      return f.p90 - f.p10;
    };
    expect(span(high)).toBeGreaterThan(span(low));
  });
});

describe("simulateDecumulation", () => {
  const base = {
    initialPortfolio: 1000000,
    annualSpending: 40000, // 4% → regra dos 4%
    realAnnualReturn: 0.04,
    annualVolatility: 0.12,
    years: 30,
  };

  it("sem volatilidade e saque < retorno: sobrevive sempre", () => {
    const res = simulateDecumulation({ ...base, annualVolatility: 0, trials: 100 });
    expect(res.survivalProb).toBe(1);
  });

  it("saque muito maior que o patrimônio: quebra sempre", () => {
    const res = simulateDecumulation({
      ...base,
      annualSpending: base.initialPortfolio, // saca tudo no 1º ano
      annualVolatility: 0,
      trials: 100,
    });
    expect(res.survivalProb).toBe(0);
  });

  it("é reprodutível e survivalProb ∈ [0,1]", () => {
    const a = simulateDecumulation({ ...base, trials: 2000 });
    const b = simulateDecumulation({ ...base, trials: 2000 });
    expect(a.survivalProb).toBe(b.survivalProb);
    expect(a.survivalProb).toBeGreaterThanOrEqual(0);
    expect(a.survivalProb).toBeLessThanOrEqual(1);
  });

  it("volatilidade introduz risco de ruína mesmo na regra dos 4%", () => {
    const res = simulateDecumulation({ ...base, annualVolatility: 0.18, trials: 4000 });
    expect(res.survivalProb).toBeLessThan(1); // sequência de retornos pode quebrar
    expect(res.bands).toHaveLength(base.years + 1);
  });
});
