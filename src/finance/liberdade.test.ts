import { describe, it, expect } from "vitest";
import {
  freedomPct,
  yearsOfFreedom,
  monthsToIndependence,
  computeStreak,
  isNextMonth,
  prevMonth,
  addMonthsLabel,
  suggestWealthMilestones,
  type MonthBalance,
} from "./liberdade";

describe("freedomPct", () => {
  it("é patrimônio ÷ número da independência × 100", () => {
    expect(freedomPct(250_000, 1_000_000)).toBe(25);
    expect(freedomPct(1_000_000, 1_000_000)).toBe(100);
  });
  it("NÃO capa em 100 (pode passar — mais que livre)", () => {
    expect(freedomPct(1_500_000, 1_000_000)).toBe(150);
  });
  it("retorna 0 se o alvo é inválido", () => {
    expect(freedomPct(100, 0)).toBe(0);
    expect(freedomPct(100, Infinity)).toBe(0);
  });
});

describe("yearsOfFreedom", () => {
  it("é patrimônio ÷ custo anual", () => {
    expect(yearsOfFreedom(120_000, 60_000)).toBe(2);
  });
  it("null se o custo é ≤ 0", () => {
    expect(yearsOfFreedom(100_000, 0)).toBeNull();
  });
  it("não fica negativo", () => {
    expect(yearsOfFreedom(-50_000, 10_000)).toBe(0);
  });
});

describe("monthsToIndependence", () => {
  it("0 quando já alcançou", () => {
    expect(
      monthsToIndependence({ eligibleWealth: 1_000_000, monthlyContribution: 1000, realAnnualReturn: 0.04, independenceNumber: 1_000_000 }),
    ).toBe(0);
  });
  it("estimativa positiva quando ainda falta", () => {
    const m = monthsToIndependence({ eligibleWealth: 100_000, monthlyContribution: 2000, realAnnualReturn: 0.04, independenceNumber: 600_000 });
    expect(m).toBeGreaterThan(0);
    expect(m).toBeLessThan(2400); // < 200 anos
  });
  it("null quando inalcançável (sem aporte nem juro, abaixo do alvo)", () => {
    expect(
      monthsToIndependence({ eligibleWealth: 10_000, monthlyContribution: 0, realAnnualReturn: 0, independenceNumber: 1_000_000 }),
    ).toBeNull();
  });
});

describe("isNextMonth / prevMonth", () => {
  it("detecta mês de calendário seguinte (inclui virada de ano)", () => {
    expect(isNextMonth("2026-01", "2026-02")).toBe(true);
    expect(isNextMonth("2025-12", "2026-01")).toBe(true);
    expect(isNextMonth("2026-01", "2026-03")).toBe(false);
    expect(isNextMonth("2026-02", "2026-01")).toBe(false);
  });
  it("prevMonth vira o ano corretamente", () => {
    expect(prevMonth("2026-01")).toBe("2025-12");
    expect(prevMonth("2026-06")).toBe("2026-05");
  });
  it("addMonthsLabel soma meses", () => {
    expect(addMonthsLabel(new Date(2026, 5, 15), 0)).toBe("2026-06");
    expect(addMonthsLabel(new Date(2026, 5, 15), 8)).toBe("2027-02");
  });
});

describe("computeStreak", () => {
  const b = (month: string, balance: number): MonthBalance => ({ month, balance });

  it("conta meses consecutivos positivos a partir do mais recente", () => {
    const s = computeStreak([b("2026-01", 100), b("2026-02", 200), b("2026-03", 50)]);
    expect(s.current).toBe(3);
    expect(s.record).toBe(3);
  });

  it("um mês negativo zera a atual mas mantém o recorde", () => {
    // 3 meses bons, 1 ruim, 1 bom → atual=1, recorde=3
    const s = computeStreak([
      b("2026-01", 100), b("2026-02", 100), b("2026-03", 100),
      b("2026-04", -20), b("2026-05", 100),
    ]);
    expect(s.current).toBe(1);
    expect(s.record).toBe(3);
  });

  it("um buraco no calendário quebra a sequência", () => {
    // falta fev → run reinicia
    const s = computeStreak([b("2026-01", 100), b("2026-03", 100), b("2026-04", 100)]);
    expect(s.current).toBe(2); // mar, abr
    expect(s.record).toBe(2);
  });

  it("limiar configurável (saldo precisa superar minBalance)", () => {
    const s = computeStreak([b("2026-01", 100), b("2026-02", 100)], 150);
    expect(s.current).toBe(0);
    expect(s.record).toBe(0);
  });

  it("não desordena com entrada fora de ordem", () => {
    const s = computeStreak([b("2026-03", 50), b("2026-01", 100), b("2026-02", 200)]);
    expect(s.current).toBe(3);
    expect(s.record).toBe(3);
  });

  it("vazio → zeros", () => {
    expect(computeStreak([])).toEqual({ current: 0, record: 0 });
  });
});

describe("suggestWealthMilestones", () => {
  it("gera uma escada crescente de marcos redondos", () => {
    const ms = suggestWealthMilestones(80_000);
    expect(ms.length).toBeGreaterThan(0);
    for (let i = 1; i < ms.length; i++) expect(ms[i]).toBeGreaterThan(ms[i - 1]);
  });
  it("funciona com referência zero (ponto de partida sensato)", () => {
    const ms = suggestWealthMilestones(0);
    expect(ms.length).toBeGreaterThan(0);
    expect(ms[0]).toBeGreaterThan(0);
  });
  it("não passa do teto (Número da Independência) — sem escada irreal", () => {
    // ~605k de patrimônio, independência ~1.5M: nenhum marco acima de 1.5M (nada de 25M).
    const ms = suggestWealthMilestones(605_000, 1_500_000);
    expect(ms.length).toBeGreaterThan(0);
    expect(Math.max(...ms)).toBeLessThanOrEqual(1_500_000);
    // inclui o último marco já passado (≤ 605k) e os próximos alcançáveis
    expect(ms.some((v) => v <= 605_000)).toBe(true);
    expect(ms.some((v) => v > 605_000)).toBe(true);
  });
  it("sem teto, limita a um múltiplo razoável do patrimônio (não dispara)", () => {
    const ms = suggestWealthMilestones(605_000);
    expect(Math.max(...ms)).toBeLessThanOrEqual(605_000 * 3);
  });
});
