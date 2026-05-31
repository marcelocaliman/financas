import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
// react cache() é trivial fora do request; mockamos pra import isolado.
vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>();
  return { ...actual, cache: <T,>(fn: T) => fn };
});
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import {
  rollforwardAnnual,
  rollforwardMonthly,
  type AnnualTaxTable,
  type MonthlyTaxTable,
} from "@/services/ir/ir-tax-tables";

const annual2026: AnnualTaxTable = {
  year: 2026,
  brackets: [
    { upTo: 30000, rate: 0, deduct: 0 },
    { upTo: Infinity, rate: 0.275, deduct: 10000 },
  ],
  simplesPct: 0.2,
  simplesLimit: 16754.34,
  dependentDeduction: 2275.08,
  educationLimitPerPerson: 3561.5,
  elderlyMonthlyExemption: 1903.98,
  source: "Lei 15.270/25",
  publishedAt: "2025-11-26",
  isEstimate: false,
  notes: null,
};

describe("rollforwardAnnual", () => {
  it("projeta pra ano futuro marcando estimativa e preservando brackets", () => {
    const t = rollforwardAnnual(annual2026, 2027);
    expect(t.year).toBe(2027);
    expect(t.isEstimate).toBe(true);
    expect(t.publishedAt).toBeNull();
    expect(t.source).toContain("projetada de 2026");
    expect(t.brackets).toEqual(annual2026.brackets); // mesma estrutura
    expect(t.simplesLimit).toBe(annual2026.simplesLimit);
  });

  it("retroage pra ano passado com texto adequado", () => {
    const t = rollforwardAnnual(annual2026, 2022);
    expect(t.year).toBe(2022);
    expect(t.isEstimate).toBe(true);
    expect(t.source).toContain("retroagida de 2026");
  });

  it("não muta a tabela base", () => {
    const before = JSON.stringify(annual2026);
    rollforwardAnnual(annual2026, 2030);
    expect(JSON.stringify(annual2026)).toBe(before);
  });
});

describe("rollforwardMonthly", () => {
  const monthly: MonthlyTaxTable = {
    year: 2026,
    effectiveFromMonth: 1,
    brackets: [{ upTo: Infinity, rate: 0.275, deduct: 900 }],
    dependentDeduction: 189.59,
    source: "Lei 15.270/25",
    isEstimate: false,
    notes: null,
  };
  it("projeta marcando estimativa", () => {
    const t = rollforwardMonthly(monthly, 2028);
    expect(t.year).toBe(2028);
    expect(t.isEstimate).toBe(true);
    expect(t.brackets).toEqual(monthly.brackets);
  });
});
