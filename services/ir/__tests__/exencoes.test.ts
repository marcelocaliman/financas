import { describe, it, expect } from "vitest";
import {
  ageAtYearEnd,
  elderlyAnnualExemption,
  elderlyMonthsFactor,
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
  it("aceita fator parcial (ano do aniversário)", () => {
    expect(elderlyAnnualExemption(MONTHLY, 3)).toBe(Math.round(MONTHLY * 3 * 100) / 100);
  });
});

describe("elderlyMonthsFactor — conta do mês do aniversário (IN 1500/14)", () => {
  it("ainda não fez 65 → 0", () => {
    expect(elderlyMonthsFactor("1980-05-01", 2026)).toBe(0);
  });
  it("anos após os 65 → ano cheio (13)", () => {
    expect(elderlyMonthsFactor("1955-05-01", 2026)).toBe(13);
  });
  it("ano em que completa 65: nasceu em janeiro → 13 (ano cheio)", () => {
    expect(elderlyMonthsFactor("1961-01-10", 2026)).toBe(13);
  });
  it("ano em que completa 65: nasceu em novembro → 3 (nov+dez+13º)", () => {
    expect(elderlyMonthsFactor("1961-11-10", 2026)).toBe(3);
  });
  it("ano em que completa 65: nasceu em dezembro → 2 (dez+13º)", () => {
    expect(elderlyMonthsFactor("1961-12-10", 2026)).toBe(2);
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

  it("ano do aniversário (nasceu em novembro): teto parcial = mensal × 3", () => {
    const novElder = { birthDate: "1961-11-10", hasSeriousIllness: false };
    const r = splitAposentadoriaExemption(50000, novElder, 2026, MONTHLY);
    expect(r.isento).toBe(Math.round(MONTHLY * 3 * 100) / 100); // não o ANNUAL cheio
    expect(r.reason).toBe("idade_65");
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
