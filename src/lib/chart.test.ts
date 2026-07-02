import { describe, it, expect } from "vitest";
import { trendDomain, shortMonth } from "./chart";

describe("trendDomain", () => {
  it("começa perto do mínimo (não em zero) p/ a curva preencher a altura", () => {
    const [lo, hi] = trendDomain([1_200_000, 1_250_000, 1_313_886]);
    expect(lo).toBeGreaterThan(1_000_000); // NÃO cola em zero
    expect(lo).toBeLessThan(1_200_000); // com uma folga abaixo do min
    expect(hi).toBeGreaterThan(1_313_886); // e uma folga acima do max
  });

  it("mínimo real fica acima do piso do eixo (linha arranca de baixo, não do topo)", () => {
    const values = [1_200_000, 1_313_886];
    const [lo, hi] = trendDomain(values);
    const minPos = (Math.min(...values) - lo) / (hi - lo); // 0 = base, 1 = topo
    expect(minPos).toBeGreaterThan(0); // não está grudado na base
    expect(minPos).toBeLessThan(0.35); // mas fica na parte de baixo do gráfico
  });

  it("série plana abre uma banda em torno do valor (não degenera)", () => {
    const [lo, hi] = trendDomain([500, 500, 500]);
    expect(lo).toBeLessThan(500);
    expect(hi).toBeGreaterThan(500);
    expect(hi).toBeGreaterThan(lo);
  });

  it("dados positivos nunca inventam eixo negativo", () => {
    const [lo] = trendDomain([10, 20, 30]);
    expect(lo).toBeGreaterThanOrEqual(0);
  });

  it("permite piso negativo quando o patrimônio é negativo (dívida > ativos)", () => {
    const [lo] = trendDomain([-5000, -2000, 1000]);
    expect(lo).toBeLessThan(-5000);
  });

  it("lida com vazio sem quebrar", () => {
    expect(trendDomain([])).toEqual([0, 1]);
  });
});

describe("shortMonth", () => {
  it("formata AAAA-MM em mês/ano curto", () => {
    expect(shortMonth("2026-06", "pt")).toMatch(/26/);
  });
  it("devolve a entrada se não for AAAA-MM", () => {
    expect(shortMonth("lixo", "pt")).toBe("lixo");
  });
});
