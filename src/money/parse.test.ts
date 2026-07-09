import { describe, it, expect } from "vitest";
import { parseAmount, formatAmountEdit, formatNumberEdit, parseLocaleNumber, maskAmountInput } from "./parse";
import type { Currency } from "./currency";

describe("maskAmountInput — máscara centavos", () => {
  it("os 2 últimos dígitos são os centavos; pontuação entra sozinha (BRL)", () => {
    expect(maskAmountInput("1", "BRL")).toEqual({ display: "0,01", value: 0.01 });
    expect(maskAmountInput("123", "BRL")).toEqual({ display: "1,23", value: 1.23 });
    expect(maskAmountInput("123456", "BRL")).toEqual({ display: "1.234,56", value: 1234.56 });
    expect(maskAmountInput("", "BRL")).toEqual({ display: "", value: undefined });
  });
  it("ignora qualquer pontuação já digitada (só os dígitos importam)", () => {
    expect(maskAmountInput("1.234,56", "BRL").value).toBe(1234.56);
    expect(maskAmountInput("1234.56", "BRL").value).toBe(1234.56); // usuário digitou ponto → ignorado
    expect(maskAmountInput("R$ 50000", "BRL").value).toBe(500); // "50000" → 500,00
  });
  it("respeita o locale da moeda (USD usa vírgula milhar, ponto decimal)", () => {
    expect(maskAmountInput("123456", "USD")).toEqual({ display: "1,234.56", value: 1234.56 });
  });
});

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

describe("parseLocaleNumber — round-trip estrito (sem o bug do decimal de 3 dígitos)", () => {
  const CURS: Currency[] = ["BRL", "EUR", "USD", "GBP"];
  const VALUES = [0.005, 0.125, 1.234, 2.005, 0.001, 2800, 320000, 41.8, 1234.56];
  for (const cur of CURS) {
    for (const v of VALUES) {
      it(`${cur}: format(${v}) re-parseia em ${v}`, () => {
        expect(parseLocaleNumber(formatNumberEdit(v, cur), cur)).toBe(v);
      });
    }
  }
  it("pt-BR: 0,005 é 0.005 (não 5) e 2.800 é 2800", () => {
    expect(parseLocaleNumber("0,005", "BRL")).toBe(0.005);
    expect(parseLocaleNumber("2.800", "BRL")).toBe(2800);
  });
  it("en-US: 0.005 é 0.005 e 2,800 é 2800", () => {
    expect(parseLocaleNumber("0.005", "USD")).toBe(0.005);
    expect(parseLocaleNumber("2,800", "USD")).toBe(2800);
  });
  it("vazio/lixo → null", () => {
    expect(parseLocaleNumber("", "BRL")).toBeNull();
    expect(parseLocaleNumber("—", "BRL")).toBeNull();
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
