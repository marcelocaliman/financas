import { describe, it, expect } from "vitest";
import { computeGcap } from "@/lib/financial/gcap-calculator";

describe("computeGcap — bens móveis (isenção 35k/mês)", () => {
  it("venda única de R$ 20k → isenta", () => {
    const r = computeGcap({
      salePrice: 20_000,
      acquisitionCost: 10_000,
      acquiredAt: "2020-01-01",
      saleDate: "2026-03-15",
      assetKind: "movable",
    });
    expect(r.exemption.applied).toBe(true);
    expect(r.exemption.kind).toBe("bem_movel_35k");
    expect(r.taxDue).toBe(0);
  });

  it("venda única de R$ 50k → NÃO isenta, paga 15%", () => {
    const r = computeGcap({
      salePrice: 50_000,
      acquisitionCost: 20_000,
      acquiredAt: "2020-01-01",
      saleDate: "2026-03-15",
      assetKind: "movable",
    });
    expect(r.exemption.applied).toBe(false);
    // Lucro = 30k, sem FR pra móveis, 15% = 4500
    expect(r.taxDue).toBe(4500);
  });

  it("duas vendas no mesmo mês somando > 35k → NÃO isenta", () => {
    const r = computeGcap({
      salePrice: 20_000,
      acquisitionCost: 5_000,
      acquiredAt: "2020-01-01",
      saleDate: "2026-03-15",
      assetKind: "movable",
      otherMovableSalesSameMonth: 30_000, // soma = 50k
    });
    expect(r.exemption.applied).toBe(false);
    expect(r.taxDue).toBeGreaterThan(0);
  });

  it("FR1/FR2 não aplica em bens móveis", () => {
    const r = computeGcap({
      salePrice: 100_000,
      acquisitionCost: 30_000,
      acquiredAt: "1998-01-01",
      saleDate: "2026-03-15",
      assetKind: "movable",
    });
    expect(r.reductionFactorPre88).toBeNull();
    expect(r.reductionFactor96To05).toBeNull();
    // Lucro 70k, sem redução, 15% = 10500
    expect(r.taxDue).toBe(10_500);
  });
});
