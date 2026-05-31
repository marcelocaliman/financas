import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/services/currency", () => ({ getRateMapAt: vi.fn() }));

import { calcCryptoTax, type CryptoBracket } from "@/services/ir/exterior-crypto";

const BRACKETS: CryptoBracket[] = [
  { upTo: 5_000_000, rate: 0.15 },
  { upTo: 10_000_000, rate: 0.175 },
  { upTo: 30_000_000, rate: 0.2 },
  { upTo: Infinity, rate: 0.225 },
];

describe("calcCryptoTax (faixas vindas do banco)", () => {
  it("lucro na 1ª faixa → 15%", () => {
    const r = calcCryptoTax(1_000_000, BRACKETS);
    expect(r.rate).toBe(0.15);
    expect(r.tax).toBeCloseTo(150_000, 2);
  });

  it("lucro cruzando faixas soma por fatia (progressivo)", () => {
    // 7M: 5M×15% + 2M×17,5% = 750.000 + 350.000 = 1.100.000
    const r = calcCryptoTax(7_000_000, BRACKETS);
    expect(r.tax).toBeCloseTo(1_100_000, 2);
    expect(r.rate).toBe(0.175);
  });

  it("lucro zero/negativo → imposto zero", () => {
    expect(calcCryptoTax(0, BRACKETS).tax).toBe(0);
    expect(calcCryptoTax(-100, BRACKETS).tax).toBe(0);
  });

  it("usa o default quando não passa faixas", () => {
    expect(calcCryptoTax(1_000_000).tax).toBeCloseTo(150_000, 2);
  });
});
