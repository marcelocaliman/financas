import { describe, it, expect } from "vitest";
import { projectMonthEnd } from "@/lib/financial/projection";

describe("projectMonthEnd — estável no começo do mês", () => {
  it("dia 1: NÃO extrapola (R$ 3k não vira R$ 90k projetados)", () => {
    const r = projectMonthEnd(15_185, 3_169, 1, 30);
    // sem extrapolação: projetado = despesa real; net = renda − despesa
    expect(r.projectedExpense).toBe(3_169);
    expect(r.projectedNet).toBe(12_016);
    expect(r.confidence).toBe("low");
  });

  it("dia 4 ainda não extrapola", () => {
    const r = projectMonthEnd(10_000, 2_000, 4, 30);
    expect(r.projectedExpense).toBe(2_000);
  });

  it("dia 10: extrapola pelo ritmo diário", () => {
    // 3.000 em 10 dias → 300/dia × 20 restantes = 6.000 → projetado 9.000
    const r = projectMonthEnd(10_000, 3_000, 10, 30);
    expect(r.projectedExpense).toBe(9_000);
    expect(r.projectedNet).toBe(1_000);
    expect(r.confidence).toBe("high");
  });

  it("mês completo (daysElapsed = daysInMonth) → sem dias restantes", () => {
    const r = projectMonthEnd(10_000, 6_000, 30, 30);
    expect(r.projectedExpense).toBe(6_000);
    expect(r.remainingDays).toBe(0);
  });
});
