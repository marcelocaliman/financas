import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>();
  return { ...actual, cache: <T,>(fn: T) => fn };
});
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { assembleImposto, computeRedutorAnual } from "@/services/ir/tax-math";
import type { AnnualTaxTable } from "@/services/ir/ir-tax-tables";

// Tabela sintética (faixas redondas) — testa a ARITMÉTICA, não a tabela oficial.
const TABLE: AnnualTaxTable = {
  year: 2025,
  brackets: [
    { upTo: 30000, rate: 0, deduct: 0 },
    { upTo: 60000, rate: 0.15, deduct: 4500 },
    { upTo: Infinity, rate: 0.275, deduct: 12000 },
  ],
  simplesPct: 0.2,
  simplesLimit: 16754.34,
  dependentDeduction: 2275.08,
  educationLimitPerPerson: 3561.5,
  elderlyMonthlyExemption: 1903.98,
  source: "sintética",
  publishedAt: null,
  isEstimate: false,
  notes: null,
};

const noDeductions = {
  educacao: 0,
  eduPeople: 0,
  saude: 0,
  pgblPrev: 0,
  pensao: 0,
  outros: 0,
  donations: 0,
  inssFromPay: 0,
};

function base(overrides: Partial<Parameters<typeof assembleImposto>[0]> = {}) {
  return assembleImposto({
    year: 2025,
    baseTributavelBruta: 0,
    inssAndOfficial: 0,
    numDependents: 0,
    deductions: noDeductions,
    irrfRetained: 0,
    carneLeaoCredit: 0,
    taxTable: TABLE,
    ...overrides,
  });
}

describe("computeRedutorAnual (Lei 15.270/25)", () => {
  it("não aplica antes de 2026", () => {
    expect(computeRedutorAnual(2025, 50000, 3000)).toBe(0);
  });
  it("zera o imposto até R$ 60k em 2026", () => {
    expect(computeRedutorAnual(2026, 50000, 3000)).toBe(3000);
  });
  it("na faixa, é valor FIXO em reais (8429,73 − 0,095575×renda), não fração do imposto", () => {
    // y = 74.100 (meio da faixa): redução = 8429,73 − 0,095575×74100 = 1347,62
    // — independe do imposto bruto (antes o bug devolvia 50% do imposto).
    expect(computeRedutorAnual(2026, 74100, 8377.5)).toBeCloseTo(1347.62, 2);
    expect(computeRedutorAnual(2026, 74100, 2000)).toBeCloseTo(1347.62, 2);
    // só limita quando a redução passa do imposto bruto
    expect(computeRedutorAnual(2026, 74100, 500)).toBe(500);
  });
  it("zera acima de R$ 88.200", () => {
    expect(computeRedutorAnual(2026, 90000, 8000)).toBe(0);
  });
});

describe("perfil: renda baixa (isento)", () => {
  it("imposto zero nos dois modelos", () => {
    const r = base({ baseTributavelBruta: 25000 });
    expect(r.completo.grossTax).toBe(0);
    expect(r.simples.grossTax).toBe(0);
    expect(r.recommendation).toBe("completo"); // empate → completo
  });
});

describe("perfil: renda média sem deduções → simples vence", () => {
  const r = base({ baseTributavelBruta: 100000 });
  it("completo: 100k × 27,5% − 12k = 15.500", () => {
    expect(r.completo.grossTax).toBeCloseTo(15500, 2);
  });
  it("simples: desconto 16.754,34, base 83.245,66 → 10.892,56", () => {
    expect(r.simples.descontoPadrao).toBeCloseTo(16754.34, 2);
    expect(r.simples.grossTax).toBeCloseTo(10892.5565, 2);
  });
  it("recomenda simples e calcula a economia", () => {
    expect(r.recommendation).toBe("simples");
    expect(r.savings).toBeCloseTo(4607.4435, 2);
  });
});

describe("perfil: muitas deduções → completo vence", () => {
  const r = base({
    baseTributavelBruta: 100000,
    inssAndOfficial: 11000,
    numDependents: 2,
    deductions: { ...noDeductions, saude: 20000, pensao: 5000 },
  });
  it("totalDeducoes soma INSS + dependentes + saúde + pensão", () => {
    // 11000 + 2*2275.08 + 20000 + 5000 = 40550.16
    expect(r.completo.totalDeducoes).toBeCloseTo(40550.16, 2);
  });
  it("completo fica menor que simples", () => {
    expect(r.recommendation).toBe("completo");
    expect(r.completo.netDue).toBeLessThan(r.simples.netDue);
  });
});

describe("limites de dedução", () => {
  it("educação respeita o teto por pessoa", () => {
    const r = base({
      baseTributavelBruta: 100000,
      deductions: { ...noDeductions, educacao: 10000, eduPeople: 1 },
    });
    expect(r.completo.educacaoLimitApplied).toBeCloseTo(3561.5, 2);
  });
  it("PGBL respeita 12% da renda", () => {
    const r = base({
      baseTributavelBruta: 100000,
      deductions: { ...noDeductions, pgblPrev: 20000 },
    });
    expect(r.completo.pgblLimitApplied).toBeCloseTo(12000, 2);
  });
});

describe("créditos (IRRF + carnê-leão) reduzem o devido", () => {
  it("netDue desconta IRRF retido e carnê-leão pago", () => {
    const r = base({
      baseTributavelBruta: 100000,
      irrfRetained: 5000,
      carneLeaoCredit: 3000,
    });
    // completo grossTax 15500 − 5000 − 3000 = 7500
    expect(r.completo.netDue).toBeCloseTo(7500, 2);
  });
});

describe("perfil 2026: redutor zera imposto de renda baixa", () => {
  it("base 50k em 2026 → imposto 0 nos dois modelos", () => {
    const r = base({ year: 2026, baseTributavelBruta: 50000 });
    expect(r.completo.grossTax).toBe(0);
    expect(r.simples.grossTax).toBe(0);
  });
});
