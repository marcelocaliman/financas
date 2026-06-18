import { describe, it, expect } from "vitest";
import { convert, formatMoney, groupNumber, parseNumber, type RateTable } from "./currency";

const rates: RateTable = { BRL: 1, EUR: 5.97, USD: 5.45, GBP: 6.9 };

describe("convert", () => {
  it("é identidade quando from === to", () => {
    expect(convert(123.45, "EUR", "EUR", rates)).toBe(123.45);
  });

  it("EUR → BRL multiplica pela taxa", () => {
    expect(convert(100, "EUR", "BRL", rates)).toBeCloseTo(597, 6);
  });

  it("BRL → EUR divide pela taxa", () => {
    expect(convert(597, "BRL", "EUR", rates)).toBeCloseTo(100, 6);
  });

  it("ida e volta preserva o valor", () => {
    const back = convert(convert(250, "BRL", "EUR", rates), "EUR", "BRL", rates);
    expect(back).toBeCloseTo(250, 6);
  });

  it("converte entre duas não-base via base (USD → EUR)", () => {
    // 109 USD → base = 109×5.45 = 594.05 BRL → /5.97 = 99.50… EUR
    expect(convert(109, "USD", "EUR", rates)).toBeCloseTo((109 * 5.45) / 5.97, 6);
  });
});

describe("formatMoney", () => {
  it("formata BRL com símbolo e sem centavos por padrão", () => {
    const s = formatMoney(1234, "BRL");
    expect(s).toContain("R$");
    expect(s).not.toContain(",00");
  });

  it("respeita maximumFractionDigits", () => {
    expect(formatMoney(1.5, "EUR", { maximumFractionDigits: 2 })).toContain("1,5");
  });
});

describe("groupNumber / parseNumber", () => {
  it("agrupa o milhar no locale da moeda", () => {
    expect(groupNumber(20000, "BRL")).toBe("20.000"); // pt-BR
    expect(groupNumber(20000, "USD")).toBe("20,000"); // en-US
  });

  it("parseia milhar e decimal conforme o locale", () => {
    expect(parseNumber("20.000", "BRL")).toBe(20000); // ponto = milhar em pt
    expect(parseNumber("20000,5", "BRL")).toBe(20000.5); // vírgula = decimal em pt
    expect(parseNumber("20,000", "USD")).toBe(20000); // vírgula = milhar em en
    expect(parseNumber("20000.5", "USD")).toBe(20000.5); // ponto = decimal em en
  });

  it("ida e volta (número → texto agrupado → número)", () => {
    for (const n of [0, 8, 4108, 20000, 605269]) {
      expect(parseNumber(groupNumber(n, "BRL"), "BRL")).toBe(n);
      expect(parseNumber(groupNumber(n, "USD"), "USD")).toBe(n);
    }
  });

  it("vazio/inválido → NaN", () => {
    expect(parseNumber("", "BRL")).toBeNaN();
    expect(parseNumber("abc", "BRL")).toBeNaN();
  });
});
