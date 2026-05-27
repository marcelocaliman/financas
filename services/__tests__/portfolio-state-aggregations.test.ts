import { describe, it, expect } from "vitest";

/**
 * Tests de invariantes dos cálculos agregados do portfolio-state.
 * Reimplementa a lógica de agregação como função pura pra testar sem DB.
 *
 * Garante:
 *   - totals == soma dos items
 *   - byClass == soma dos items por classe
 *   - variation = today - applied (pra cada agregação)
 *   - yieldUntilEnd = projected - today
 *   - variationPct lida com applied=0
 */

type Item = {
  applied: number;
  today: number;
  projected: number;
  assetClass: string;
};

function aggregate(items: Item[]) {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const totals = {
    applied: round2(items.reduce((s, i) => s + i.applied, 0)),
    today: round2(items.reduce((s, i) => s + i.today, 0)),
    projected: round2(items.reduce((s, i) => s + i.projected, 0)),
    variation: 0,
    variationPct: 0,
    yieldUntilEnd: 0,
  };
  totals.variation = round2(totals.today - totals.applied);
  totals.variationPct =
    totals.applied > 0 ? round2((totals.variation / totals.applied) * 100) : 0;
  totals.yieldUntilEnd = round2(totals.projected - totals.today);

  // totalsNet: exclui caixa de corretora e cartão (alinhado com portfolio-state)
  const isNetIncluded = (it: Item) =>
    it.assetClass !== "account_investment_cash" &&
    it.assetClass !== "account_credit_card";
  const net = items.filter(isNetIncluded);
  const totalsNet = {
    applied: round2(net.reduce((s, i) => s + i.applied, 0)),
    today: round2(net.reduce((s, i) => s + i.today, 0)),
    projected: round2(net.reduce((s, i) => s + i.projected, 0)),
    variation: 0,
    variationPct: 0,
    yieldUntilEnd: 0,
  };
  totalsNet.variation = round2(totalsNet.today - totalsNet.applied);
  totalsNet.variationPct =
    totalsNet.applied > 0
      ? round2((totalsNet.variation / totalsNet.applied) * 100)
      : 0;
  totalsNet.yieldUntilEnd = round2(totalsNet.projected - totalsNet.today);

  const classMap = new Map<string, { applied: number; today: number; projected: number }>();
  for (const i of items) {
    const cur = classMap.get(i.assetClass) ?? { applied: 0, today: 0, projected: 0 };
    cur.applied += i.applied;
    cur.today += i.today;
    cur.projected += i.projected;
    classMap.set(i.assetClass, cur);
  }
  const byClass = Array.from(classMap.entries()).map(([label, v]) => ({
    label,
    applied: round2(v.applied),
    today: round2(v.today),
    projected: round2(v.projected),
    variation: round2(v.today - v.applied),
    variationPct: v.applied > 0 ? round2(((v.today - v.applied) / v.applied) * 100) : 0,
    yieldUntilEnd: round2(v.projected - v.today),
  }));

  return { totals, totalsNet, byClass };
}

describe("portfolio-state · agregações", () => {
  it("totals = soma dos items", () => {
    const items: Item[] = [
      { applied: 100, today: 110, projected: 120, assetClass: "A" },
      { applied: 200, today: 180, projected: 180, assetClass: "B" },
    ];
    const { totals } = aggregate(items);
    expect(totals.applied).toBe(300);
    expect(totals.today).toBe(290);
    expect(totals.projected).toBe(300);
    expect(totals.variation).toBe(-10);
    expect(totals.yieldUntilEnd).toBe(10);
  });

  it("variationPct = variation / applied × 100", () => {
    const items: Item[] = [
      { applied: 1000, today: 1100, projected: 1100, assetClass: "X" },
    ];
    const { totals } = aggregate(items);
    expect(totals.variationPct).toBe(10);
  });

  it("variationPct = 0 quando applied = 0 (sem divisão por zero)", () => {
    const items: Item[] = [{ applied: 0, today: 100, projected: 100, assetClass: "X" }];
    const { totals } = aggregate(items);
    expect(totals.variationPct).toBe(0);
  });

  it("byClass agrupa corretamente por assetClass", () => {
    const items: Item[] = [
      { applied: 100, today: 110, projected: 110, assetClass: "Renda fixa" },
      { applied: 200, today: 220, projected: 240, assetClass: "Renda fixa" },
      { applied: 500, today: 480, projected: 480, assetClass: "Ações" },
    ];
    const { byClass } = aggregate(items);
    const rf = byClass.find((c) => c.label === "Renda fixa");
    const acoes = byClass.find((c) => c.label === "Ações");
    expect(rf?.applied).toBe(300);
    expect(rf?.today).toBe(330);
    expect(rf?.projected).toBe(350);
    expect(rf?.variation).toBe(30);
    expect(rf?.variationPct).toBe(10);
    expect(rf?.yieldUntilEnd).toBe(20);
    expect(acoes?.applied).toBe(500);
    expect(acoes?.variation).toBe(-20);
    expect(acoes?.variationPct).toBe(-4);
  });

  it("totalsNet exclui caixa de corretora e cartão", () => {
    const items: Item[] = [
      { applied: 1000, today: 1100, projected: 1100, assetClass: "stock" },
      { applied: 500, today: 500, projected: 500, assetClass: "account_checking" },
      // Caixa parado em corretora — vai dobrar com investimentos se contado:
      { applied: 200, today: 200, projected: 200, assetClass: "account_investment_cash" },
      // Cartão como saldo negativo (dívida) — não conta no líquido:
      { applied: -300, today: -300, projected: -300, assetClass: "account_credit_card" },
    ];
    const { totals, totalsNet } = aggregate(items);
    // Bruto: tudo somado (cartão como negativo + caixa corretora positivo)
    expect(totals.today).toBe(1500); // 1100 + 500 + 200 - 300
    // Net: só stock + checking
    expect(totalsNet.today).toBe(1600); // 1100 + 500
    expect(totalsNet.applied).toBe(1500); // 1000 + 500
  });

  it("totalsNet = totals quando não tem caixa-corretora nem cartão", () => {
    const items: Item[] = [
      { applied: 1000, today: 1100, projected: 1200, assetClass: "fixed_income_public" },
      { applied: 500, today: 500, projected: 500, assetClass: "account_checking" },
      { applied: 2000, today: 1900, projected: 1900, assetClass: "physical_vehicle" },
    ];
    const { totals, totalsNet } = aggregate(items);
    expect(totalsNet.applied).toBe(totals.applied);
    expect(totalsNet.today).toBe(totals.today);
    expect(totalsNet.projected).toBe(totals.projected);
  });

  it("portfolio do Marcelo (cenário real): bate na soma", () => {
    // Cenário aproximado: RF + Ações + Veículos + PJ
    const items: Item[] = [
      { applied: 224356.36, today: 250567.32, projected: 271744.68, assetClass: "Renda fixa" },
      { applied: 204437.44, today: 207675.14, projected: 225227.35, assetClass: "Renda fixa" },
      { applied: 212.08, today: 253.42, projected: 274.69, assetClass: "Renda fixa" },
      { applied: 165.05, today: 165.05, projected: 165.05, assetClass: "Renda fixa" }, // Conta XP
      { applied: 66276, today: 57792, projected: 57792, assetClass: "Ações" },
      { applied: 34727.84, today: 26534.72, projected: 26534.72, assetClass: "Ações" },
      { applied: 16920, today: 17128, projected: 17128, assetClass: "Ações" },
      { applied: 42449.20, today: 40000, projected: 40000, assetClass: "Veículos" },
      { applied: 1000, today: 1000, projected: 1000, assetClass: "Participações" },
    ];
    const { totals } = aggregate(items);
    expect(totals.today).toBeCloseTo(601115.65, 2);
    expect(totals.applied).toBeCloseTo(590543.97, 2);
    // Projetado: RF compõe (~+38.750), demais mantém atual
    expect(totals.projected).toBeCloseTo(639866.49, 1);
    expect(totals.variation).toBeCloseTo(10571.68, 2);
    // Ganho até 31/12 = projeção - hoje (só RF cresce)
    expect(totals.yieldUntilEnd).toBeCloseTo(38750.84, 1);
  });
});
