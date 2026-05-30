import { describe, it, expect } from "vitest";
import { computeFire, computeMonthsToFire } from "@/lib/financial/fire";

/**
 * FIX sob teste: a classificação "coast" deixou de cravar 6% a.a. e passou a
 * usar o realAnnualReturnPct configurado (computeFire → classifyFire).
 *
 * "coast" exige (lendo classifyFire):
 *   - não fat (nw < 1.3×target), não achieved (nw < target), coverage < 1
 *   - monthlyAddition > 0
 *   - monthsCoast (meses pra chegar ao target SEM aporte, usando o retorno
 *     configurado) != null && <= 360 (30 anos × 12)
 *
 * Derivação à mão (juros compostos, sem aporte, r>0):
 *   n = ln(FV/PV) / ln(1 + r_mensal),  r_mensal = (1+annual/100)^(1/12) − 1
 *   n <= 360  ⟺  FV/PV <= (1+annual/100)^30  ⟺  PV >= FV/(1+annual/100)^30
 *
 * Cenário base: target 10k/mês, SWR 4% → FV = 10k×12 / 0.04 = 3.000.000.
 *   PV escolhido = 700.000.
 *   Limiar de PV (n=360):  @8% ≈ 298.132   |  @2% ≈ 1.656.213
 *   Logo PV=700k:  @8% supera o limiar → coast viável;  @2% fica abaixo → não.
 *   n_coast @8% = ln(3.000.000/700.000)/ln(1.08^(1/12)) ≈ 226.9 meses (<360)
 *   n_coast @2% = mesma fórmula                          ≈ 881.9 meses (>360)
 */

const FV = 3_000_000; // 10k/mês, SWR 4%
const PV = 700_000;

function coastMonthsByHand(pv: number, annualPct: number): number {
  // sem aporte, r>0: n = ln(fv/pv)/ln(1+r_mensal)
  const rMonthly = Math.pow(1 + annualPct / 100, 1 / 12) - 1;
  return Math.log(FV / pv) / Math.log(1 + rMonthly);
}

function baseInputs(realAnnualReturnPct: number) {
  return {
    currentNetWorth: PV,
    monthlyAddition: 1_000, // > 0, requisito pra coast ser avaliado
    targetMonthlyIncome: 10_000,
    realAnnualReturnPct,
    swrPct: 4,
  };
}

describe("computeFire — classificação Coast depende do realAnnualReturnPct", () => {
  it("retorno ALTO (8%) ⇒ chega ao alvo sem aporte em <=30 anos ⇒ 'coast'", () => {
    // Derivado à mão: n_coast @8% ≈ 226.9 meses (< 360) ⇒ coast viável.
    const nHand = coastMonthsByHand(PV, 8);
    expect(nHand).toBeLessThan(360);
    expect(nHand).toBeCloseTo(226.91, 0);

    const r = computeFire(baseInputs(8));
    expect(r.classification).toBe("coast");
  });

  it("retorno BAIXO (2%) ⇒ NÃO chega em <=30 anos ⇒ NÃO é 'coast' (cai em 'building')", () => {
    // Derivado à mão: n_coast @2% ≈ 881.9 meses (> 360) ⇒ coast inviável.
    const nHand = coastMonthsByHand(PV, 2);
    expect(nHand).toBeGreaterThan(360);
    expect(nHand).toBeCloseTo(881.88, 0);

    const r = computeFire(baseInputs(2));
    // Mesma carteira/target; muda só o retorno. coverage=0.233 (<0.4 e <0.6),
    // sem coast ⇒ não é regular/barista/lean ⇒ "building".
    expect(r.classification).toBe("building");
  });

  it("PROVA do fix: mesmas entradas exceto o retorno ⇒ a classificação MUDA", () => {
    const high = computeFire(baseInputs(8)).classification;
    const low = computeFire(baseInputs(2)).classification;
    expect(high).not.toBe(low);
    expect(high).toBe("coast");
    expect(low).toBe("building");
  });

  it("monthsToFire (com aporte real) também varia com o retorno — não é constante", () => {
    // Derivado à mão (fórmula geral PV·(1+r)^n + PMT·[(1+r)^n−1]/r = FV, pmt=1000):
    //   @8% ≈ 203.5 meses ; @2% ≈ 615.6 meses
    const high = computeFire(baseInputs(8));
    const low = computeFire(baseInputs(2));
    expect(high.monthsToFire).toBeCloseTo(203.5, 0);
    expect(low.monthsToFire).toBeCloseTo(615.6, 0);
    expect(high.monthsToFire).not.toBe(low.monthsToFire);
    expect(high.monthsToFire!).toBeLessThan(low.monthsToFire!);
  });
});

describe("computeMonthsToFire — coast (sem aporte) confere com a derivação à mão", () => {
  it("@8%: 700k → 3M sem aporte ≈ 226.9 meses", () => {
    const n = computeMonthsToFire({
      currentNetWorth: PV,
      targetNetWorth: FV,
      monthlyAddition: 0,
      realAnnualReturnPct: 8,
    });
    expect(n).toBeCloseTo(coastMonthsByHand(PV, 8), 4);
    expect(n).toBeCloseTo(226.91, 1);
  });

  it("@2%: 700k → 3M sem aporte ≈ 881.9 meses (> 360, fora do coast)", () => {
    const n = computeMonthsToFire({
      currentNetWorth: PV,
      targetNetWorth: FV,
      monthlyAddition: 0,
      realAnnualReturnPct: 2,
    });
    expect(n).toBeCloseTo(coastMonthsByHand(PV, 2), 4);
    expect(n).toBeCloseTo(881.88, 1);
    expect(n!).toBeGreaterThan(360);
  });

  it("sanidade: o coast-months muda com o retorno (monotonicamente decrescente)", () => {
    const n2 = computeMonthsToFire({ currentNetWorth: PV, targetNetWorth: FV, monthlyAddition: 0, realAnnualReturnPct: 2 })!;
    const n5 = computeMonthsToFire({ currentNetWorth: PV, targetNetWorth: FV, monthlyAddition: 0, realAnnualReturnPct: 5 })!;
    const n8 = computeMonthsToFire({ currentNetWorth: PV, targetNetWorth: FV, monthlyAddition: 0, realAnnualReturnPct: 8 })!;
    expect(n2).toBeGreaterThan(n5);
    expect(n5).toBeGreaterThan(n8);
  });
});

describe("computeFire — sanidade (casos normais)", () => {
  it("retorno alto mas monthlyAddition = 0 ⇒ coast NÃO é avaliado (requer aporte > 0)", () => {
    // Mesma carteira/retorno do caso 'coast', porém sem aporte: a guarda
    // monthlyAddition > 0 impede coast. coverage=0.233 ⇒ "building".
    const r = computeFire({
      currentNetWorth: PV,
      monthlyAddition: 0,
      targetMonthlyIncome: 10_000,
      realAnnualReturnPct: 8,
      swrPct: 4,
    });
    expect(r.classification).toBe("building");
  });

  it("patrimônio = target ⇒ 'achieved' independe do retorno", () => {
    const r = computeFire({
      currentNetWorth: 3_000_000,
      monthlyAddition: 1_000,
      targetMonthlyIncome: 10_000,
      realAnnualReturnPct: 2,
      swrPct: 4,
    });
    expect(r.classification).toBe("achieved");
  });
});
