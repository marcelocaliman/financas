import { describe, it, expect } from "vitest";
import { currencyBreakdown } from "./composition";

describe("currencyBreakdown", () => {
  it("percentuais fecham SEMPRE em 100 (maior resto), com 3+ moedas", () => {
    const segs = currencyBreakdown(
      [
        { amount: 1, currency: "BRL" },
        { amount: 1, currency: "USD" },
        { amount: 1, currency: "GBP" },
      ],
      "BRL",
    );
    expect(segs.reduce((s, x) => s + x.pct, 0)).toBe(100);
  });

  it("uma moeda → 100%", () => {
    const segs = currencyBreakdown([{ amount: 50, currency: "EUR" }], "BRL");
    expect(segs).toHaveLength(1);
    expect(segs[0].pct).toBe(100);
  });

  it("sem itens → []", () => {
    expect(currencyBreakdown([], "BRL")).toEqual([]);
  });

  it("preserva a ordem canônica de moedas (BRL, EUR, USD, GBP)", () => {
    const segs = currencyBreakdown(
      [
        { amount: 100, currency: "USD" },
        { amount: 100, currency: "BRL" },
        { amount: 100, currency: "EUR" },
      ],
      "BRL",
    );
    expect(segs.map((s) => s.currency)).toEqual(["BRL", "EUR", "USD"]);
  });
});
