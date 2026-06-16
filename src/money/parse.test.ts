import { describe, it, expect } from "vitest";
import { parseAmount, formatAmountEdit, formatNumberEdit } from "./parse";

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

describe("formatAmountEdit — valor monetário com SEMPRE 2 casas", () => {
  it("não arredonda os centavos no round-trip", () => {
    const formatted = formatAmountEdit(1234.56, "BRL");
    expect(parseAmount(formatted)).toBe(1234.56);
  });
  it("sempre 2 casas decimais (locale pt-BR)", () => {
    expect(formatAmountEdit(320000, "BRL")).toBe("320.000,00");
    expect(formatAmountEdit(41.8, "BRL")).toBe("41,80");
  });
});

describe("formatNumberEdit — número genérico com casas controladas", () => {
  it("decimals fixo aplica exatamente N casas", () => {
    expect(formatNumberEdit(41.8, "BRL", 2)).toBe("41,80");
    expect(formatNumberEdit(180, "BRL", 0)).toBe("180");
  });
  it("sem decimals = flexível com milhar (qtd)", () => {
    expect(formatNumberEdit(2800, "BRL")).toBe("2.800");
    expect(formatNumberEdit(100.5, "BRL")).toBe("100,5");
  });
  it("undefined → string vazia", () => {
    expect(formatNumberEdit(undefined, "BRL")).toBe("");
  });
});
