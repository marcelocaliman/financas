import { describe, it, expect } from "vitest";
import { parseSpot } from "./spot";

describe("parseSpot", () => {
  it("lê o preço quando ativo e moeda batem", () => {
    expect(parseSpot({ data: { amount: "320984.62", base: "BTC", currency: "BRL" } }, "BTC", "BRL")).toBeCloseTo(320984.62, 2);
    expect(parseSpot({ data: { amount: "4180.68", base: "XAU", currency: "USD" } }, "XAU", "USD")).toBeCloseTo(4180.68, 2);
  });

  it("rejeita (null) quando o ativo ou a moeda não conferem", () => {
    expect(parseSpot({ data: { amount: "1", base: "ETH", currency: "BRL" } }, "BTC", "BRL")).toBeNull();
    expect(parseSpot({ data: { amount: "1", base: "BTC", currency: "USD" } }, "BTC", "BRL")).toBeNull();
  });

  it("rejeita (null) valores ausentes, não-numéricos ou ≤ 0", () => {
    expect(parseSpot({ data: { base: "BTC", currency: "BRL" } }, "BTC", "BRL")).toBeNull();
    expect(parseSpot({ data: { amount: "x", base: "BTC", currency: "BRL" } }, "BTC", "BRL")).toBeNull();
    expect(parseSpot({ data: { amount: "0", base: "BTC", currency: "BRL" } }, "BTC", "BRL")).toBeNull();
    expect(parseSpot({}, "BTC", "BRL")).toBeNull();
  });
});
