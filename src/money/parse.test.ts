import { describe, it, expect } from "vitest";
import { parseAmount, formatAmountEdit } from "./parse";

describe("parseAmount — milhar vs decimal", () => {
  const cases: [string, number | null][] = [
    ["1.500", 1500], // ponto + 3 dígitos, sem vírgula → MILHAR
    ["320.000", 320000],
    ["1.234.567", 1234567],
    ["1.234,56", 1234.56], // BR: ponto milhar, vírgula decimal
    ["1.500,00", 1500],
    ["12,5", 12.5], // vírgula única, 1 dígito → decimal
    ["12.50", 12.5], // ponto único, 2 dígitos → decimal
    ["1,234.56", 1234.56], // US: vírgula milhar, ponto decimal
    ["320000", 320000],
    ["R$ 1.250,90", 1250.9],
    ["", null],
    ["-", null],
    ["-200", -200],
  ];
  for (const [input, expected] of cases) {
    it(`"${input}" → ${expected}`, () => {
      expect(parseAmount(input)).toBe(expected);
    });
  }
});

describe("formatAmountEdit — preserva centavos", () => {
  it("não arredonda os centavos no round-trip", () => {
    const formatted = formatAmountEdit(1234.56, "BRL");
    expect(parseAmount(formatted)).toBe(1234.56);
  });
  it("inteiro sem casas decimais penduradas", () => {
    expect(formatAmountEdit(320000, "BRL")).toBe("320.000");
  });
});
