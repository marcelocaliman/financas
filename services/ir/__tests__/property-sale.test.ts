import { describe, it, expect } from "vitest";
import {
  computeGcap,
  calcProgressiveGcap,
  computeArt18Reduction,
  computeReductionFactorPre88,
  computeReductionFactor96To05,
} from "@/lib/financial/gcap-calculator";

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
    expect(calcProgressiveGcap(5_000_000).tax).toBe(750_000);
  });
  it("lucro R$ 7M → 15% cheio + 17.5% no excedente = R$ 1,1M", () => {
    expect(calcProgressiveGcap(7_000_000).tax).toBe(1_100_000);
  });
});

describe("computeArt18Reduction (Lei 7.713/88 art. 18)", () => {
  it("≤1969 → 100%", () => {
    expect(computeArt18Reduction(1969)).toBe(1);
    expect(computeArt18Reduction(1950)).toBe(1);
  });
  it("1980 → 45% (100 − 11×5)", () => {
    expect(computeArt18Reduction(1980)).toBeCloseTo(0.45, 5);
  });
  it("1988 → 5%", () => {
    expect(computeArt18Reduction(1988)).toBeCloseTo(0.05, 5);
  });
  it("≥1989 → sem redução (0)", () => {
    expect(computeArt18Reduction(1989)).toBe(0);
    expect(computeArt18Reduction(2010)).toBe(0);
  });
});

describe("FR1/FR2 (Lei 11.196/05 art. 40)", () => {
  it("FR1 só conta até nov/2005, não até a venda", () => {
    // adquirido jun/1990 → m1 = jan/1996..nov/2005 = 118 meses (piso §2º)
    const fr1 = computeReductionFactorPre88("1990-06-01", "2026-06-10");
    expect(fr1).toBeCloseTo(0.4937, 3);
  });
  it("FR1 = 1 para imóvel adquirido depois de nov/2005", () => {
    expect(computeReductionFactorPre88("2020-01-01", "2026-01-01")).toBe(1);
  });
  it("FR2 aplica a imóvel pós-2005 (conta de dez/2005 ou da aquisição)", () => {
    // adquirido 2020-01 → m2 = jan/2020..jan/2026 = 72 meses
    expect(computeReductionFactor96To05("2020-01-01", "2026-01-15")).toBeCloseTo(0.7776, 3);
  });
});

describe("computeGcap — sem isenção (FR2 aplica a pós-2005)", () => {
  it("imóvel comprado 2020 por 500k, vendido 2026 por 800k", () => {
    const r = computeGcap({
      salePrice: 800_000,
      acquisitionCost: 500_000,
      acquiredAt: "2020-01-01",
      saleDate: "2026-01-15",
    });
    expect(r.grossProfit).toBe(300_000);
    expect(r.reductionFactorPre88).toBe(1); // pós-2005 → sem FR1
    expect(r.reductionFactor96To05).toBeCloseTo(0.7776, 3); // FR2 aplica
    expect(r.taxableProfit).toBeCloseTo(233276, 0);
    expect(r.taxDue).toBeCloseTo(34991.4, 0); // não mais 45.000
    expect(r.darfDueDate).toMatch(/^2026-02-/);
  });
});

describe("computeGcap — imóvel pré-1996 (FR1 + FR2 cumulativos)", () => {
  it("adquirido 1990 por 0, vendido 2026 por 1M → bate o exemplo da auditoria", () => {
    const r = computeGcap({
      salePrice: 1_000_000,
      acquisitionCost: 0,
      acquiredAt: "1990-06-01",
      saleDate: "2026-06-10",
    });
    expect(r.reductionFactorPre88).toBeCloseTo(0.4937, 3);
    expect(r.reductionFactor96To05).toBeCloseTo(0.4234, 3);
    expect(r.taxableProfit).toBeCloseTo(209008, 0);
    expect(r.taxDue).toBeCloseTo(31351, 0); // ~R$ 31.351, não ~R$ 11k
  });
});

describe("computeGcap — redução Lei 7.713/88 (imóveis antigos)", () => {
  it("imóvel de 1969 → redução 100% → ganho não tributável", () => {
    const r = computeGcap({
      salePrice: 1_000_000,
      acquisitionCost: 500_000,
      acquiredAt: "1969-01-01",
      saleDate: "2026-01-10",
    });
    expect(r.art18Reduction).toBe(1);
    expect(r.taxableProfit).toBe(0);
    expect(r.taxDue).toBe(0);
  });
  it("imóvel de 1980 (redução 45%) + FR1/FR2", () => {
    const r = computeGcap({
      salePrice: 1_000_000,
      acquisitionCost: 0,
      acquiredAt: "1980-03-01",
      saleDate: "2026-01-10",
    });
    expect(r.art18Reduction).toBeCloseTo(0.45, 5);
    expect(r.taxableProfit).toBeCloseTo(116980, 0);
    expect(r.taxDue).toBeCloseTo(17547, 0);
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

  it("reaplicação parcial (50%) → metade do lucro (já com FR2) tributável", () => {
    const r = computeGcap({
      salePrice: 1_000_000,
      acquisitionCost: 500_000,
      acquiredAt: "2018-01-01",
      saleDate: "2026-01-15",
      willReinvestIn180Days: true,
      reinvestAmount: 500_000, // 50% do salePrice
    });
    expect(r.exemption.applied).toBe(true);
    // ganho 500k × FR2(0.715) = ~357,5k; 50% isento → ~178,8k tributável
    expect(r.taxableProfit).toBeCloseTo(178761, 0);
    expect(r.taxDue).toBeCloseTo(26814, 0);
  });
});

describe("computeGcap — DARF due date (recua fim de semana e feriado)", () => {
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
