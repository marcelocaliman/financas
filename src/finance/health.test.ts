import { describe, it, expect } from "vitest";
import {
  savingsScore,
  diversificationScore,
  reserveScore,
  debtScore,
  goalsScore,
  compositeHealth,
  DEFAULT_HEALTH_WEIGHTS,
  type HealthParts,
} from "./health";

describe("savingsScore", () => {
  it("satura em 1 ao atingir o alvo", () => {
    expect(savingsScore(20, 20)).toBe(1);
    expect(savingsScore(30, 20)).toBe(1);
  });
  it("escala abaixo do alvo", () => {
    expect(savingsScore(10, 20)).toBe(0.5);
  });
  it("poupança negativa → 0", () => {
    expect(savingsScore(-5, 20)).toBe(0);
  });
});

describe("diversificationScore", () => {
  it("uma classe só → 0", () => {
    expect(diversificationScore([100])).toBe(0);
  });
  it("duas iguais → 0.5; quatro iguais → 0.75", () => {
    expect(diversificationScore([50, 50])).toBeCloseTo(0.5, 6);
    expect(diversificationScore([25, 25, 25, 25])).toBeCloseTo(0.75, 6);
  });
  it("sem patrimônio → null", () => {
    expect(diversificationScore([])).toBeNull();
    expect(diversificationScore([0, 0])).toBeNull();
  });
});

describe("reserveScore", () => {
  it("cobre o alvo → 1; metade → 0.5", () => {
    expect(reserveScore(6, 6)).toBe(1);
    expect(reserveScore(3, 6)).toBe(0.5);
    expect(reserveScore(9, 6)).toBe(1);
  });
});

describe("debtScore", () => {
  it("sem dívida → 1", () => {
    expect(debtScore(0, 100)).toBe(1);
  });
  it("dívida = maxRatio dos ativos → 0", () => {
    expect(debtScore(100, 100)).toBe(0);
    expect(debtScore(50, 100)).toBe(0.5);
  });
});

describe("goalsScore", () => {
  it("progresso médio 0..100 → 0..1", () => {
    expect(goalsScore(0)).toBe(0);
    expect(goalsScore(75)).toBe(0.75);
    expect(goalsScore(120)).toBe(1);
  });
});

describe("compositeHealth", () => {
  it("média ponderada das dimensões com dados", () => {
    const parts: HealthParts = { savings: 1, diversification: 0.5, reserve: 1, debt: 1, goals: 0.5 };
    // pesos iguais (1 cada): (1+0.5+1+1+0.5)/5 = 0.8 → 80
    expect(compositeHealth(parts, DEFAULT_HEALTH_WEIGHTS)).toBeCloseTo(80, 6);
  });
  it("ignora dimensões sem dados (null) e renormaliza", () => {
    const parts: HealthParts = { savings: 1, diversification: null, reserve: 1, debt: null, goals: null };
    // só savings + reserve: (1+1)/2 = 1 → 100
    expect(compositeHealth(parts, DEFAULT_HEALTH_WEIGHTS)).toBe(100);
  });
  it("respeita pesos customizados", () => {
    const parts: HealthParts = { savings: 1, diversification: 0, reserve: null, debt: null, goals: null };
    // savings peso 3, diversification peso 1: (1*3 + 0*1)/4 = 0.75 → 75
    const w = { ...DEFAULT_HEALTH_WEIGHTS, savings: 3, diversification: 1 };
    expect(compositeHealth(parts, w)).toBe(75);
  });
  it("nenhuma dimensão com dados → null", () => {
    const parts: HealthParts = { savings: null, diversification: null, reserve: null, debt: null, goals: null };
    expect(compositeHealth(parts, DEFAULT_HEALTH_WEIGHTS)).toBeNull();
  });
});
