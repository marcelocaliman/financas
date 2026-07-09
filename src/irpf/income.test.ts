import { describe, it, expect } from "vitest";
import { summarizeIncome } from "./income";
import type { Income } from "@/domain/types";

const inc = (over: Partial<Income>): Income => ({
  id: "i", month: "2025-01", categoryId: "salario", name: "", currency: "BRL", amount: 1000, ...over,
});

describe("summarizeIncome", () => {
  it("soma por categoria+moeda só do ano-base", () => {
    const rows = summarizeIncome([
      inc({ month: "2025-01", categoryId: "salario", amount: 5000 }),
      inc({ month: "2025-02", categoryId: "salario", amount: 5000 }),
      inc({ month: "2025-03", categoryId: "aluguel", amount: 2000 }),
      inc({ month: "2024-12", categoryId: "salario", amount: 9999 }), // ano anterior → ignora
      inc({ month: "2025-04", categoryId: "dividendos", currency: "USD", amount: 300 }),
    ], 2025);

    const sal = rows.find((r) => r.categoryId === "salario" && r.currency === "BRL");
    expect(sal?.total).toBe(10000);
    expect(sal?.count).toBe(2);
    expect(rows.find((r) => r.categoryId === "dividendos")?.currency).toBe("USD");
    expect(rows.some((r) => r.total === 9999)).toBe(false); // ano anterior fica de fora
    expect(rows[0].total).toBeGreaterThanOrEqual(rows[rows.length - 1].total); // ordenado desc
  });

  it("teto de mês: ignora renda de meses ADIANTE do atual (ano em andamento)", () => {
    const rows = summarizeIncome([
      inc({ month: "2026-05", categoryId: "salario", amount: 5000 }), // até o teto → conta
      inc({ month: "2026-07", categoryId: "salario", amount: 5000 }), // = teto → conta
      inc({ month: "2026-08", categoryId: "salario", amount: 5000 }), // futuro → ignora
      inc({ month: "2026-12", categoryId: "salario", amount: 5000 }), // futuro → ignora
    ], 2026, "2026-07");
    expect(rows.find((r) => r.categoryId === "salario")?.total).toBe(10000); // só maio + julho
  });

  it("ano PASSADO: o teto (mês atual) não corta nada (o ano todo já passou)", () => {
    const rows = summarizeIncome([
      inc({ month: "2025-03", amount: 3000 }),
      inc({ month: "2025-11", amount: 3000 }),
    ], 2025, "2026-07");
    expect(rows.find((r) => r.categoryId === "salario")?.total).toBe(6000);
  });
});
