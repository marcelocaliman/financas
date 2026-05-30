import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { computeGoalStatus } from "@/services/goals";

/**
 * computeGoalStatus(current, target, targetDateISO, trackingStartISO?)
 *
 * A função usa `new Date()` ("today") internamente, então fixamos o relógio
 * via vi.setSystemTime para podermos derivar monthsBetween À MÃO.
 *
 * Pin: today = 2026-05-15T00:00:00Z  → getUTCFullYear=2026, getUTCMonth=4 (mai, 0-idx)
 *
 * monthsBetween(a,b) = (b.year - a.year)*12 + (b.month - a.month)   [UTC, mes 0..11]
 * monthsRemaining = max(0, monthsBetween(today, target_d))
 * elapsed = max(0, monthsBetween(start_d, today))
 * time_progress = elapsed / (elapsed + monthsRemaining)
 * pace = current/target
 *   pace>=1                       -> concluida
 *   pace > time_progress + 0.05   -> adiantada
 *   pace < time_progress - 0.05   -> atrasada
 *   senão                         -> no_ritmo
 */

const TODAY = "2026-05-15T00:00:00Z";

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(TODAY));
});

afterAll(() => {
  vi.useRealTimers();
});

describe("computeGoalStatus — early returns", () => {
  it("(a) target <= 0 → neutro (target = 0)", () => {
    expect(computeGoalStatus(50, 0, "2027-05-15", "2026-01-15")).toBe("neutro");
  });

  it("(a) target negativo → neutro", () => {
    expect(computeGoalStatus(50, -10, "2027-05-15", "2026-01-15")).toBe("neutro");
  });

  it("(b) current === target → concluida (pace = 1)", () => {
    // pace = 100/100 = 1 >= 1 → concluida (mesmo sem datas)
    expect(computeGoalStatus(100, 100, null, null)).toBe("concluida");
  });

  it("(b) current > target → concluida (pace > 1)", () => {
    // pace = 150/100 = 1.5 → concluida; vence até target_date passada
    expect(computeGoalStatus(150, 100, "2020-01-01", "2019-01-01")).toBe("concluida");
  });

  it("(c) sem target_date (e pace < 1) → neutro", () => {
    // pace = 50/100 = 0.5 < 1, targetDateISO null → neutro
    expect(computeGoalStatus(50, 100, null, "2026-01-15")).toBe("neutro");
  });

  it("(d) sem trackingStart (undefined) → neutro", () => {
    // pace=0.5, monthsRemaining = monthsBetween(2026-05, 2027-05)=12 (>0),
    // trackingStart ausente → neutro (não chuta atrasada/adiantada)
    expect(computeGoalStatus(50, 100, "2027-05-15")).toBe("neutro");
  });

  it("(d) trackingStart = null explícito → neutro", () => {
    expect(computeGoalStatus(50, 100, "2027-05-15", null)).toBe("neutro");
  });
});

describe("computeGoalStatus — meta recém-criada (elapsed = 0)", () => {
  // today=2026-05-15, trackingStart=2026-05-15 → elapsed = monthsBetween(mai,mai)=0
  // targetDate=2026-09-15 → monthsRemaining = monthsBetween(2026-05,2026-09)
  //                       = (0)*12 + (8-4) = 4
  // totalSpan = 0+4 = 4 → time_progress = 0/4 = 0
  it("(e) pace baixo (0.10) com elapsed=0 → adiantada, NÃO atrasada arbitrária", () => {
    // pace=0.10 ; time_progress=0 ; 0.10 > 0 + 0.05 → adiantada
    expect(computeGoalStatus(10, 100, "2026-09-15", "2026-05-15")).toBe("adiantada");
  });

  it("(e) pace minúsculo (0.02) com elapsed=0 → no_ritmo (dentro de 5pp)", () => {
    // pace=0.02 ; time_progress=0 ; 0.02 não > 0.05 e não < -0.05 → no_ritmo
    expect(computeGoalStatus(2, 100, "2026-09-15", "2026-05-15")).toBe("no_ritmo");
  });

  it("(e) pace zero com elapsed=0 → no_ritmo", () => {
    // pace=0 ; time_progress=0 ; |0-0|=0 ≤ 0.05 → no_ritmo
    expect(computeGoalStatus(0, 100, "2026-09-15", "2026-05-15")).toBe("no_ritmo");
  });
});

describe("computeGoalStatus — metade do tempo decorrido (time_progress = 0.5)", () => {
  // trackingStart=2025-11-15, today=2026-05-15, targetDate=2026-11-15
  // elapsed = monthsBetween(2025-11, 2026-05) = (2026-2025)*12 + (4-10) = 12 - 6 = 6
  // monthsRemaining = monthsBetween(2026-05, 2026-11) = 0*12 + (10-4) = 6
  // totalSpan = 12 → time_progress = 6/12 = 0.5
  const TS = "2025-11-15";
  const TD = "2026-11-15";

  it("(f) pace 0.70 > 0.55 → adiantada", () => {
    expect(computeGoalStatus(70, 100, TD, TS)).toBe("adiantada");
  });

  it("(f) pace 0.40 < 0.45 → atrasada", () => {
    expect(computeGoalStatus(40, 100, TD, TS)).toBe("atrasada");
  });

  it("(f) pace 0.52 (dentro de 5pp de 0.5) → no_ritmo", () => {
    expect(computeGoalStatus(52, 100, TD, TS)).toBe("no_ritmo");
  });

  it("(f) pace 0.55 exatamente = 0.5 + 0.05 (não estritamente maior) → no_ritmo", () => {
    // pace > time_progress + 0.05 é estrito; 0.55 > 0.55 é falso → cai pra no_ritmo
    expect(computeGoalStatus(55, 100, TD, TS)).toBe("no_ritmo");
  });

  it("(f) pace 0.45 exatamente = 0.5 - 0.05 (não estritamente menor) → no_ritmo", () => {
    // pace < time_progress - 0.05 é estrito; 0.45 < 0.45 é falso → no_ritmo
    expect(computeGoalStatus(45, 100, TD, TS)).toBe("no_ritmo");
  });
});

describe("computeGoalStatus — target_date no/antes do mês atual (monthsRemaining = 0)", () => {
  // targetDate=2026-05-15, today=2026-05-15 → monthsBetween(mai,mai)=0 → monthsRemaining=0
  it("monthsRemaining=0 + pace 0.5 → atrasada", () => {
    expect(computeGoalStatus(50, 100, "2026-05-15", "2026-01-15")).toBe("atrasada");
  });

  it("monthsRemaining=0 + pace 0.96 (≥0.95) → no_ritmo", () => {
    expect(computeGoalStatus(96, 100, "2026-05-15", "2026-01-15")).toBe("no_ritmo");
  });

  it("monthsRemaining=0 com target_date já passada + pace baixo → atrasada", () => {
    // targetDate=2026-03-15 → monthsBetween(2026-05, 2026-03) = -2 → max(0,-2)=0
    expect(computeGoalStatus(30, 100, "2026-03-15", "2026-01-15")).toBe("atrasada");
  });
});
