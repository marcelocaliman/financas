import { describe, it, expect } from "vitest";
import { computeGcap, calcProgressiveGcap } from "@/lib/financial/gcap-calculator";

describe("calcProgressiveGcap", () => {
  it("lucro zero → imposto zero", () => {
    expect(calcProgressiveGcap(0)).toEqual({ tax: 0, effectiveRate: 0 });
  });
  it("lucro R$ 100k → 15% = R$ 15k", () => {
    const r = calcProgressiveGcap(100_000);
    expect(r.tax).toBe(15_000);
    expect(r.effectiveRate).toBeCloseTo(0.15);
  });
  it("lucro R$ 5M → 15% pleno = R$ 750k", () => {
    const r = calcProgressiveGcap(5_000_000);
    expect(r.tax).toBe(750_000);
  });
  it("lucro R$ 7M → primeira faixa cheia (15%) + faixa 17.5% no excedente", () => {
    // 5M * 0.15 = 750k; 2M * 0.175 = 350k → total 1.1M
    const r = calcProgressiveGcap(7_000_000);
    expect(r.tax).toBe(1_100_000);
  });
});

describe("computeGcap — sem isenção", () => {
  it("imóvel comprado em 2020 por 500k, vendido em 2026 por 800k", () => {
    const r = computeGcap({
      salePrice: 800_000,
      acquisitionCost: 500_000,
      acquiredAt: "2020-01-01",
      saleDate: "2026-01-15",
    });
    expect(r.grossProfit).toBe(300_000);
    // FR2 não se aplica (post-2005); FR1 não se aplica (post-1996)
    expect(r.reductionFactor96To05).toBeCloseTo(1, 5);
    expect(r.taxableProfit).toBe(300_000);
    expect(r.taxDue).toBe(45_000); // 15%
    expect(r.darfDueDate).toMatch(/^2026-02-/);
  });
});

describe("computeGcap — isenção imóvel único < 440k", () => {
  it("imóvel residencial único 400k → isento", () => {
    const r = computeGcap({
      salePrice: 400_000,
      acquisitionCost: 300_000,
      acquiredAt: "2015-06-01",
      saleDate: "2026-03-01",
      isUniqueResidencialUnder440k: true,
    });
    expect(r.exemption.applied).toBe(true);
    expect(r.exemption.kind).toBe("unico_imovel_440k");
    expect(r.taxDue).toBe(0);
  });

  it("imóvel residencial 500k NÃO se enquadra na isenção 440k", () => {
    const r = computeGcap({
      salePrice: 500_000,
      acquisitionCost: 300_000,
      acquiredAt: "2015-06-01",
      saleDate: "2026-03-01",
      isUniqueResidencialUnder440k: true,
    });
    expect(r.exemption.applied).toBe(false);
    expect(r.taxDue).toBeGreaterThan(0);
  });
});

describe("computeGcap — reaplicação 180 dias", () => {
  it("reaplicação total → 100% isento", () => {
    const r = computeGcap({
      salePrice: 1_000_000,
      acquisitionCost: 500_000,
      acquiredAt: "2018-01-01",
      saleDate: "2026-01-15",
      willReinvestIn180Days: true,
    });
    expect(r.exemption.applied).toBe(true);
    expect(r.exemption.kind).toBe("reaplicacao_residencial");
    expect(r.taxDue).toBe(0);
  });

  it("reaplicação parcial (50%) → metade do lucro isento", () => {
    const r = computeGcap({
      salePrice: 1_000_000,
      acquisitionCost: 500_000,
      acquiredAt: "2018-01-01",
      saleDate: "2026-01-15",
      willReinvestIn180Days: true,
      reinvestAmount: 500_000, // 50% do salePrice
    });
    expect(r.exemption.applied).toBe(true);
    // Metade do lucro (R$ 250k) fica tributável (sem FR2 pra bem post-2005)
    expect(r.taxDue).toBe(37_500); // 250k * 15%
    expect(r.taxableProfit).toBe(250_000);
  });
});

describe("computeGcap — DARF due date", () => {
  it("venda em janeiro → DARF até último dia útil de fevereiro", () => {
    const r = computeGcap({
      salePrice: 100,
      acquisitionCost: 0,
      acquiredAt: "2020-01-01",
      saleDate: "2026-01-10",
    });
    // 28/02/2026 é sábado → recua pra sexta 27/02
    expect(r.darfDueDate).toBe("2026-02-27");
  });
});
