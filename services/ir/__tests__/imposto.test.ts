import { describe, it, expect } from "vitest";
import { calcProgressiveTax } from "@/services/ir/imposto";

describe("calcProgressiveTax (tabela anual IRPF)", () => {
  it("isento até R$ 26.963,20", () => {
    expect(calcProgressiveTax(20000)).toBe(0);
    expect(calcProgressiveTax(26963.20)).toBe(0);
  });

  it("faixa 7,5% — R$ 30k", () => {
    // 30000 * 0.075 - 2022.24 = 2250 - 2022.24 = 227.76
    expect(calcProgressiveTax(30000)).toBeCloseTo(227.76, 2);
  });

  it("faixa 15% — R$ 40k", () => {
    // 40000 * 0.15 - 4566.23 = 6000 - 4566.23 = 1433.77
    expect(calcProgressiveTax(40000)).toBeCloseTo(1433.77, 2);
  });

  it("faixa 22,5% — R$ 50k", () => {
    // 50000 * 0.225 - 7942.17 = 11250 - 7942.17 = 3307.83
    expect(calcProgressiveTax(50000)).toBeCloseTo(3307.83, 2);
  });

  it("faixa 27,5% — R$ 80k", () => {
    // 80000 * 0.275 - 10740.98 = 22000 - 10740.98 = 11259.02
    expect(calcProgressiveTax(80000)).toBeCloseTo(11259.02, 2);
  });

  it("base negativa = 0 (não há crédito tributário)", () => {
    expect(calcProgressiveTax(-1000)).toBe(0);
    expect(calcProgressiveTax(0)).toBe(0);
  });

  it("nunca retorna negativo (parcela a deduzir > imposto bruto)", () => {
    // Base bem baixa que cai na faixa 7,5% mas com parcela alta
    expect(calcProgressiveTax(27000)).toBeGreaterThanOrEqual(0);
  });
});
