import { describe, it, expect } from "vitest";
import { nextMonth, monthsBetween } from "./months";

describe("nextMonth", () => {
  it("avança o mês", () => {
    expect(nextMonth("2026-06")).toBe("2026-07");
  });
  it("vira o ano", () => {
    expect(nextMonth("2025-12")).toBe("2026-01");
  });
});

describe("monthsBetween (exclusivo nos dois lados)", () => {
  it("preenche o intervalo no mesmo ano", () => {
    expect(monthsBetween("2026-03", "2026-07")).toEqual(["2026-04", "2026-05", "2026-06"]);
  });
  it("preenche atravessando a virada do ano", () => {
    expect(monthsBetween("2025-11", "2026-02")).toEqual(["2025-12", "2026-01"]);
  });
  it("vazio quando os meses são adjacentes", () => {
    expect(monthsBetween("2026-05", "2026-06")).toEqual([]);
  });
  it("vazio quando iguais ou invertidos", () => {
    expect(monthsBetween("2026-06", "2026-06")).toEqual([]);
    expect(monthsBetween("2026-08", "2026-03")).toEqual([]);
  });
  it("preenche um buraco longo (vários anos)", () => {
    expect(monthsBetween("2024-12", "2026-02")).toEqual([
      "2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06",
      "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
      "2026-01",
    ]);
  });
});
