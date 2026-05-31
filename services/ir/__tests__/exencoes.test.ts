import { describe, it, expect } from "vitest";
import {
  ageAtYearEnd,
  elderlyAnnualExemption,
  splitAposentadoriaExemption,
} from "@/services/ir/exencoes";

const MONTHLY = 1903.98;
const ANNUAL = 24751.74; // 1903.98 × 13

describe("ageAtYearEnd", () => {
  it("calcula idade no fim do ano-base", () => {
    expect(ageAtYearEnd("1960-03-10", 2026)).toBe(66);
    expect(ageAtYearEnd("1961-12-31", 2026)).toBe(65);
  });
  it("retorna null sem data ou data inválida", () => {
    expect(ageAtYearEnd(null, 2026)).toBeNull();
    expect(ageAtYearEnd("10/03/1960", 2026)).toBeNull();
  });
});

describe("elderlyAnnualExemption", () => {
  it("é a parcela mensal × 13 (12 meses + 13º)", () => {
    expect(elderlyAnnualExemption(MONTHLY)).toBe(ANNUAL);
  });
});

describe("splitAposentadoriaExemption", () => {
  const young = { birthDate: "1980-01-01", hasSeriousIllness: false };
  const elder = { birthDate: "1955-01-01", hasSeriousIllness: false };
  const ill = { birthDate: "1980-01-01", hasSeriousIllness: true };

  it("não-elegível: tudo tributável", () => {
    const r = splitAposentadoriaExemption(50000, young, 2026, MONTHLY);
    expect(r).toEqual({ isento: 0, tributavel: 50000, reason: null });
  });

  it("65+: isenta até o teto anual, excedente tributável", () => {
    const r = splitAposentadoriaExemption(50000, elder, 2026, MONTHLY);
    expect(r.isento).toBe(ANNUAL);
    expect(r.tributavel).toBe(Math.round((50000 - ANNUAL) * 100) / 100);
    expect(r.reason).toBe("idade_65");
  });

  it("65+ com renda abaixo do teto: tudo isento", () => {
    const r = splitAposentadoriaExemption(20000, elder, 2026, MONTHLY);
    expect(r.isento).toBe(20000);
    expect(r.tributavel).toBe(0);
  });

  it("moléstia grave: 100% isento e prevalece sobre idade", () => {
    const r = splitAposentadoriaExemption(120000, ill, 2026, MONTHLY);
    expect(r).toEqual({ isento: 120000, tributavel: 0, reason: "molestia_grave" });
  });

  it("valor zero: nada a fazer", () => {
    const r = splitAposentadoriaExemption(0, elder, 2026, MONTHLY);
    expect(r).toEqual({ isento: 0, tributavel: 0, reason: null });
  });
});
