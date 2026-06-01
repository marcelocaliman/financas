import { describe, it, expect } from "vitest";
import {
  routeSaleKind,
  dayTradeIrrf,
  computeDarfMonth,
  lastBusinessDayOfNextMonth,
} from "@/services/ir/renda-variavel";

type Sale = {
  date: string;
  ticker: string;
  assetType: string;
  qty: number;
  unitPrice: number;
  grossSale: number;
  costBasis: number;
  profit: number;
  isDayTrade: boolean;
};

function sale(p: Partial<Sale> & { profit: number; grossSale: number; assetType: string; date: string }): Sale {
  return {
    ticker: "X", qty: 1, unitPrice: 0, costBasis: 0, isDayTrade: false, ...p,
  };
}

describe("routeSaleKind — modalidade vence o ativo (IN 1.585/15 art. 57)", () => {
  it("day-trade de OPÇÃO vai pra day_trade (20%), não options (15%)", () => {
    expect(routeSaleKind("option", true)).toBe("day_trade");
  });
  it("day-trade de FII vai pra day_trade", () => {
    expect(routeSaleKind("fii", true)).toBe("day_trade");
  });
  it("day-trade de ação vai pra day_trade", () => {
    expect(routeSaleKind("stock", true)).toBe("day_trade");
  });
  it("swing: opção→options, fii→fii, ação→swing, etf→swing", () => {
    expect(routeSaleKind("option", false)).toBe("options");
    expect(routeSaleKind("fii", false)).toBe("fii");
    expect(routeSaleKind("stock", false)).toBe("swing");
    expect(routeSaleKind("etf", false)).toBe("swing");
  });
});

describe("dayTradeIrrf — 1% sobre resultado positivo POR DIA", () => {
  it("mês com dia ganhador e dia perdedor: IRRF só sobre o dia positivo", () => {
    const sales = [
      sale({ date: "2026-03-02", assetType: "stock", grossSale: 10000, profit: 1000 }),
      sale({ date: "2026-03-05", assetType: "stock", grossSale: 10000, profit: -400 }),
    ];
    // líquido mensal = 600; mas IRRF = 1% × 1000 (só o dia positivo) = 10
    expect(dayTradeIrrf(sales)).toBeCloseTo(10, 5);
  });
  it("mesmo dia, várias operações: soma o resultado do dia", () => {
    const sales = [
      sale({ date: "2026-03-02", assetType: "stock", grossSale: 5000, profit: 300 }),
      sale({ date: "2026-03-02", assetType: "stock", grossSale: 5000, profit: -100 }),
    ];
    // dia líquido = 200 (positivo) → IRRF 1% × 200 = 2
    expect(dayTradeIrrf(sales)).toBeCloseTo(2, 5);
  });
});

describe("computeDarfMonth — alíquotas e isenção", () => {
  it("day-trade lucro 10k → 20% − IRRF (1% por dia)", () => {
    const sales = [sale({ date: "2026-03-02", assetType: "stock", grossSale: 50000, profit: 10000, isDayTrade: true })];
    const { darf } = computeDarfMonth({ kind: "day_trade", sales, carryIn: 0, year: 2026, month: 3 });
    expect(darf.taxableBase).toBe(10000);
    // grossTax 2000; IRRF 1%×10000=100; taxDue 1900
    expect(darf.irrfRetained).toBeCloseTo(100, 2);
    expect(darf.taxDue).toBeCloseTo(1900, 2);
  });

  it("swing de ações ≤ 20k de vendas → isento", () => {
    const sales = [sale({ date: "2026-03-02", assetType: "stock", grossSale: 15000, profit: 3000 })];
    const { darf } = computeDarfMonth({ kind: "swing", sales, carryIn: 0, year: 2026, month: 3 });
    expect(darf.isExempt).toBe(true);
    expect(darf.taxDue).toBe(0);
  });

  it("swing de ações > 20k → 15% − IRRF 0,005%", () => {
    const sales = [sale({ date: "2026-03-02", assetType: "stock", grossSale: 30000, profit: 5000 })];
    const { darf } = computeDarfMonth({ kind: "swing", sales, carryIn: 0, year: 2026, month: 3 });
    expect(darf.isExempt).toBe(false);
    // grossTax 750; IRRF 0,005%×30000=1,5; taxDue 748,5
    expect(darf.irrfRetained).toBeCloseTo(1.5, 2);
    expect(darf.taxDue).toBeCloseTo(748.5, 2);
  });

  it("FII não tem isenção 20k → 20%", () => {
    const sales = [sale({ date: "2026-03-02", assetType: "fii", grossSale: 15000, profit: 2000 })];
    const { darf } = computeDarfMonth({ kind: "fii", sales, carryIn: 0, year: 2026, month: 3 });
    expect(darf.isExempt).toBe(false);
    expect(darf.taxDue).toBeGreaterThan(0); // 20% × 2000 − dedo-duro
  });

  it("compensação de prejuízo (carryIn) reduz a base", () => {
    const sales = [sale({ date: "2026-03-02", assetType: "stock", grossSale: 50000, profit: 10000, isDayTrade: true })];
    const { darf, carryOut } = computeDarfMonth({ kind: "day_trade", sales, carryIn: 4000, year: 2026, month: 3 });
    expect(darf.carryforwardUsedThisMonth).toBe(4000);
    expect(darf.taxableBase).toBe(6000);
    expect(carryOut).toBe(0);
  });

  it("mês de prejuízo de day-trade preserva o IRRF dos dias positivos (crédito)", () => {
    const sales = [
      sale({ date: "2026-03-02", assetType: "stock", grossSale: 20000, profit: 2000, isDayTrade: true }),
      sale({ date: "2026-03-10", assetType: "stock", grossSale: 20000, profit: -5000, isDayTrade: true }),
    ];
    const { darf, carryOut } = computeDarfMonth({ kind: "day_trade", sales, carryIn: 0, year: 2026, month: 3 });
    expect(darf.taxDue).toBe(0);
    expect(darf.monthlyLoss).toBe(3000); // líquido −3000 vira prejuízo
    expect(carryOut).toBe(3000);
    // mas o IRRF retido no dia positivo (1% × 2000 = 20) NÃO se perde
    expect(darf.irrfRetained).toBeCloseTo(20, 2);
  });
});

describe("lastBusinessDayOfNextMonth — recua fim de semana e feriado", () => {
  it("vendas de jan/2026 → último dia útil de fev (28/02 sáb → 27/02)", () => {
    expect(lastBusinessDayOfNextMonth(2026, 1)).toBe("2026-02-27");
  });
  it("dezembro → vencimento no ano seguinte", () => {
    expect(lastBusinessDayOfNextMonth(2025, 12)).toMatch(/^2026-01-/);
  });
});
