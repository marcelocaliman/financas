import { describe, it, expect } from "vitest";
import type { RateTable } from "./currency";
import { fxDailyDelta, pairChangePct, type FxHolding } from "./fx-daily";
import { seriesFromFrankfurter } from "./rates";

// BRL = 1; demais = quantos BRL valem 1 unidade da moeda.
const TODAY: RateTable = { BRL: 1, EUR: 5.85, USD: 5.42, GBP: 7.1 };
const PREV: RateTable = { BRL: 1, EUR: 5.8, USD: 5.4, GBP: 7.1 };

describe("fxDailyDelta", () => {
  it("isola a variação cambial das posições, em BRL", () => {
    const assets: FxHolding[] = [
      { amount: 30000, currency: "EUR" },
      { amount: 40000, currency: "BRL" },
      { amount: 10000, currency: "USD" },
    ];
    const r = fxDailyDelta(assets, [], "BRL", TODAY, PREV);
    // EUR: 30000×(5,85−5,80)=1500 · USD: 10000×(5,42−5,40)=200 · BRL: 0 → 1700
    expect(r.delta).toBeCloseTo(1700, 4);
    expect(r.netWorthToday).toBeCloseTo(269700, 4); // 175500 + 40000 + 54200
    expect(r.pct).toBeCloseTo((1700 / 269700) * 100, 4);
    expect(r.hasForeign).toBe(true);
    // GBP não aparece (não há posição); BRL não entra (= moeda de exibição)
    expect(r.drivers.map((d) => d.currency)).toEqual(["EUR", "USD"]);
    expect(r.drivers[0].delta).toBeCloseTo(1500, 4);
    expect(r.drivers[0].pct).toBeCloseTo((5.85 / 5.8 - 1) * 100, 4);
  });

  it("passivo em moeda estrangeira reduz o patrimônio quando a moeda sobe", () => {
    const r = fxDailyDelta([], [{ amount: 10000, currency: "USD" }], "BRL", TODAY, PREV);
    expect(r.delta).toBeCloseTo(-200, 4); // dívida em USD ficou R$200 mais cara
    expect(r.drivers[0].currency).toBe("USD");
    expect(r.drivers[0].delta).toBeCloseTo(-200, 4);
  });

  it("sem exposição estrangeira (tudo na moeda de exibição) → sem variação", () => {
    const r = fxDailyDelta([{ amount: 50000, currency: "EUR" }], [], "EUR", TODAY, PREV);
    expect(r.delta).toBeCloseTo(0, 6);
    expect(r.hasForeign).toBe(false);
    expect(r.drivers).toHaveLength(0);
  });
});

describe("pairChangePct", () => {
  it("calcula a variação % de uma moeda contra a base", () => {
    expect(pairChangePct("EUR", "BRL", TODAY, PREV)).toBeCloseTo((5.85 / 5.8 - 1) * 100, 6);
    expect(pairChangePct("GBP", "BRL", TODAY, PREV)).toBeCloseTo(0, 6); // GBP não mexeu
  });
});

describe("seriesFromFrankfurter", () => {
  it("ordena por data e inverte as taxas (BRL-âncora)", () => {
    const s = seriesFromFrankfurter({
      rates: {
        "2026-06-26": { USD: 0.2, EUR: 0.18 },
        "2026-06-25": { USD: 0.2, EUR: 0.18 },
      },
    });
    expect(s.map((d) => d.date)).toEqual(["2026-06-25", "2026-06-26"]);
    expect(s[1].rates.USD).toBeCloseTo(5, 6); // 1/0,2
    expect(s[1].rates.BRL).toBe(1);
  });
});
