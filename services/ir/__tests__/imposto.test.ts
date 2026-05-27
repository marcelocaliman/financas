import { describe, it, expect } from "vitest";
import { calcProgressiveTax, type TaxBracket } from "@/services/ir/ir-tax-tables";

/**
 * Tests da função pura calcProgressiveTax — não depende do banco.
 * Usa fixtures de tabelas conhecidas (2024 e 2025) pra validar a aritmética.
 */

const TABELA_2024_ANUAL: TaxBracket[] = [
  { upTo: 26963.20, rate: 0, deduct: 0 },
  { upTo: 33919.80, rate: 0.075, deduct: 2022.24 },
  { upTo: 45012.60, rate: 0.15, deduct: 4566.23 },
  { upTo: 55976.16, rate: 0.225, deduct: 7942.17 },
  { upTo: Infinity, rate: 0.275, deduct: 10740.98 },
];

const TABELA_2025_ANUAL: TaxBracket[] = [
  { upTo: 27110.40, rate: 0, deduct: 0 },
  { upTo: 33919.80, rate: 0.075, deduct: 2033.28 },
  { upTo: 45012.60, rate: 0.15, deduct: 4577.27 },
  { upTo: 55976.16, rate: 0.225, deduct: 7953.21 },
  { upTo: Infinity, rate: 0.275, deduct: 10752.02 },
];

describe("calcProgressiveTax — tabela ano-base 2024", () => {
  it("isento até R$ 26.963,20", () => {
    expect(calcProgressiveTax(20000, TABELA_2024_ANUAL)).toBe(0);
    expect(calcProgressiveTax(26963.20, TABELA_2024_ANUAL)).toBe(0);
  });

  it("faixa 7,5% — R$ 30k", () => {
    // 30000 × 0,075 − 2022,24 = 2250 − 2022,24 = 227,76
    expect(calcProgressiveTax(30000, TABELA_2024_ANUAL)).toBeCloseTo(227.76, 2);
  });

  it("faixa 15% — R$ 40k", () => {
    // 40000 × 0,15 − 4566,23 = 6000 − 4566,23 = 1433,77
    expect(calcProgressiveTax(40000, TABELA_2024_ANUAL)).toBeCloseTo(1433.77, 2);
  });

  it("faixa 22,5% — R$ 50k", () => {
    expect(calcProgressiveTax(50000, TABELA_2024_ANUAL)).toBeCloseTo(3307.83, 2);
  });

  it("faixa 27,5% — R$ 80k", () => {
    expect(calcProgressiveTax(80000, TABELA_2024_ANUAL)).toBeCloseTo(11259.02, 2);
  });

  it("base zero ou negativa → 0", () => {
    expect(calcProgressiveTax(-1000, TABELA_2024_ANUAL)).toBe(0);
    expect(calcProgressiveTax(0, TABELA_2024_ANUAL)).toBe(0);
  });

  it("nunca retorna negativo (parcela a deduzir > imposto bruto)", () => {
    expect(calcProgressiveTax(27000, TABELA_2024_ANUAL)).toBeGreaterThanOrEqual(0);
  });
});

describe("calcProgressiveTax — tabela ano-base 2025", () => {
  it("isento até R$ 27.110,40 (faixa aumentou +R$ 147,20 vs 2024)", () => {
    expect(calcProgressiveTax(27110.40, TABELA_2025_ANUAL)).toBe(0);
    // Valor que era taxado em 2024 (acima de 26963) agora é isento em 2025
    expect(calcProgressiveTax(27000, TABELA_2025_ANUAL)).toBe(0);
  });

  it("faixa 7,5% — R$ 28k em 2025", () => {
    // 28000 × 0,075 − 2033,28 = 2100 − 2033,28 = 66,72
    expect(calcProgressiveTax(28000, TABELA_2025_ANUAL)).toBeCloseTo(66.72, 2);
  });

  it("diferença entre 2024 e 2025 numa mesma base", () => {
    // Mesma base R$ 28k:
    //   2024: 28000 × 0,075 − 2022,24 = 2100 − 2022,24 = 77,76
    //   2025: 28000 × 0,075 − 2033,28 = 2100 − 2033,28 = 66,72
    // Diferença = R$ 11,04
    const tax2024 = calcProgressiveTax(28000, TABELA_2024_ANUAL);
    const tax2025 = calcProgressiveTax(28000, TABELA_2025_ANUAL);
    expect(tax2024 - tax2025).toBeCloseTo(11.04, 2);
  });
});
