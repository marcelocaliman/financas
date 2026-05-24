import { describe, it, expect } from "vitest";
import { calcCryptoTax } from "@/services/ir/exterior-crypto";

describe("calcCryptoTax — faixas progressivas Lei 13.259/2016", () => {
  it("lucro zero ou negativo → sem imposto", () => {
    expect(calcCryptoTax(0)).toEqual({ rate: 0, tax: 0 });
    expect(calcCryptoTax(-1000)).toEqual({ rate: 0, tax: 0 });
  });

  it("lucro R$ 1.000.000 → 15% inteiro", () => {
    const r = calcCryptoTax(1_000_000);
    expect(r.rate).toBe(0.15);
    expect(r.tax).toBe(150_000);
  });

  it("lucro R$ 5.000.000 → todo na faixa 15%", () => {
    const r = calcCryptoTax(5_000_000);
    expect(r.tax).toBe(750_000); // 5MM × 15%
  });

  it("lucro R$ 7.000.000 → mix 15% + 17,5%", () => {
    // 5MM × 15% = 750k, +2MM × 17.5% = 350k, total = 1.100k
    const r = calcCryptoTax(7_000_000);
    expect(r.tax).toBe(1_100_000);
    expect(r.rate).toBe(0.175); // última faixa usada
  });

  it("lucro R$ 15.000.000 → 15% + 17.5% + 20%", () => {
    // 5MM*0.15 + 5MM*0.175 + 5MM*0.20 = 750k + 875k + 1MM = 2.625k
    const r = calcCryptoTax(15_000_000);
    expect(r.tax).toBe(2_625_000);
    expect(r.rate).toBe(0.20);
  });

  it("lucro R$ 40.000.000 → todas as faixas", () => {
    // 5MM*0.15 + 5MM*0.175 + 20MM*0.20 + 10MM*0.225
    // 750k + 875k + 4MM + 2.25MM = 7.875MM
    const r = calcCryptoTax(40_000_000);
    expect(r.tax).toBe(7_875_000);
    expect(r.rate).toBe(0.225);
  });

  it("lucro pequeno R$ 100k", () => {
    const r = calcCryptoTax(100_000);
    expect(r.tax).toBe(15_000); // 100k × 15%
  });
});
