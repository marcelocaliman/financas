import { describe, it, expect } from "vitest";
import { ratesFromFrankfurter, isStale, RATES_TTL_MS } from "./rates";
import { CURRENCIES } from "./currency";

describe("ratesFromFrankfurter", () => {
  it("inverte 'moeda por BRL' → 'BRL por moeda' e fixa BRL = 1", () => {
    const r = ratesFromFrankfurter({ base: "BRL", rates: { EUR: 0.1675, USD: 0.1835, GBP: 0.145 } });
    expect(r.BRL).toBe(1);
    expect(r.EUR).toBeCloseTo(1 / 0.1675, 4);
    expect(r.USD).toBeCloseTo(1 / 0.1835, 4);
    expect(r.GBP).toBeCloseTo(1 / 0.145, 4);
  });

  it("cai no default quando uma taxa vem ausente ou zero (nunca quebra o app)", () => {
    const r = ratesFromFrankfurter({ rates: { EUR: 0 } }); // EUR zero, demais ausentes
    for (const c of CURRENCIES) expect(r[c]).toBeGreaterThan(0);
  });
});

describe("isStale", () => {
  it("nunca buscado conta como velho", () => {
    expect(isStale(null, 1_000)).toBe(true);
  });
  it("recente é fresco; além do TTL é velho", () => {
    const now = 1_700_000_000_000;
    expect(isStale(now - 1_000, now)).toBe(false);
    expect(isStale(now - RATES_TTL_MS - 1, now)).toBe(true);
  });
});
